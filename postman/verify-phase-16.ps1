$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$baseUrl = "http://127.0.0.1:4000"

function Read-KeyValueFile([string]$path) {
  $values = @{}
  Get-Content -LiteralPath $path | ForEach-Object {
    if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $values[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
    }
  }
  return $values
}

function Invoke-LocalApi {
  param(
    [string]$Method,
    [string]$Path,
    [string]$Token = "",
    [object]$Body = $null
  )
  $parameters = @{
    Method = $Method
    Uri = "$baseUrl$Path"
    SkipHttpErrorCheck = $true
    TimeoutSec = 180
  }
  if ($Token) { $parameters.Headers = @{ Authorization = "Bearer $Token" } }
  if ($null -ne $Body) {
    $parameters.ContentType = "application/json"
    $parameters.Body = $Body | ConvertTo-Json -Depth 8 -Compress
  }
  $response = Invoke-WebRequest @parameters
  $parsed = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
  return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $parsed }
}

function Invoke-DocumentUpload {
  param(
    [string]$Path,
    [string]$Token,
    [string]$Title,
    [string]$VersionNote,
    [string]$FilePath
  )
  $query = "title=$([uri]::EscapeDataString($Title))&versionNote=$([uri]::EscapeDataString($VersionNote))"
  $response = Invoke-WebRequest -Method POST -Uri "$baseUrl$Path`?$query" -Headers @{
    Authorization = "Bearer $Token"
    "X-Filename" = [IO.Path]::GetFileName($FilePath)
  } -ContentType "text/plain" -InFile $FilePath -SkipHttpErrorCheck -TimeoutSec 180
  $parsed = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
  return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $parsed }
}

function Assert-Status($response, [int]$expected, [string]$label) {
  if ($response.Status -ne $expected) {
    $code = if ($response.Body.error.code) { $response.Body.error.code } else { "NO_ERROR_CODE" }
    throw "$label expected HTTP $expected but received $($response.Status) ($code)."
  }
}

function Login([string]$email, [string]$password) {
  $response = Invoke-LocalApi -Method POST -Path "/api/v1/auth/login" -Body @{
    email = $email
    password = $password
  }
  Assert-Status $response 200 "Login"
  return $response.Body.data
}

function Ask([string]$token, [string]$question) {
  $response = Invoke-LocalApi -Method POST -Path "/api/v1/knowledge/query" -Token $token -Body @{ question = $question }
  Assert-Status $response 200 "Knowledge query"
  return $response.Body.data.result
}

$postmanPath = Join-Path $repositoryRoot "postman/Smart Urban Council API Tests.postman_environment.json"
$bootstrapPath = Join-Path $repositoryRoot "apps/api/.env.bootstrap"
$postman = Get-Content -LiteralPath $postmanPath -Raw | ConvertFrom-Json
$postmanValues = @{}
$postman.values | ForEach-Object { $postmanValues[$_.key] = [string]$_.value }
$bootstrap = Read-KeyValueFile $bootstrapPath

$admin = Login $bootstrap["ADMIN_BOOTSTRAP_EMAIL"] $bootstrap["ADMIN_BOOTSTRAP_PASSWORD"]
$citizen = Login $postmanValues["citizen_email"] $postmanValues["citizen_password"]
$department = Login $postmanValues["department_account_email"] $postmanValues["department_account_password"]
$adminToken = $admin.tokens.accessToken
$citizenToken = $citizen.tokens.accessToken
$departmentToken = $department.tokens.accessToken

$integrations = Invoke-LocalApi -Method GET -Path "/api/v1/system/integrations" -Token $adminToken
Assert-Status $integrations 200 "Integration status"
$rag = $integrations.Body.data.integrations | Where-Object { $_.service -eq "rag" } | Select-Object -First 1
if ($null -eq $rag -or -not $rag.reachable -or -not $rag.providerConfigured) {
  throw "RAG integration is not reachable and configured."
}

$unauthenticated = Invoke-LocalApi -Method POST -Path "/api/v1/knowledge/query" -Body @{ question = "What is documented?" }
Assert-Status $unauthenticated 401 "Unauthenticated query"
$departmentQuery = Invoke-LocalApi -Method POST -Path "/api/v1/knowledge/query" -Token $departmentToken -Body @{ question = "What is documented?" }
Assert-Status $departmentQuery 403 "Department query"
$citizenDocuments = Invoke-LocalApi -Method GET -Path "/api/v1/knowledge/documents" -Token $citizenToken
Assert-Status $citizenDocuments 403 "Citizen document list"

$fixtureV1 = Join-Path $repositoryRoot "postman/fixtures/phase-16-knowledge-v1.txt"
$fixtureV2 = Join-Path $repositoryRoot "postman/fixtures/phase-16-knowledge-v2.txt"
$title = "Phase 16 Academic Verification Notice"
$created = Invoke-DocumentUpload -Path "/api/v1/knowledge/documents" -Token $adminToken -Title $title -VersionNote "Synthetic academic verification version 1" -FilePath $fixtureV1
Assert-Status $created 201 "Initial document ingestion"
$documentId = $created.Body.data.document.id
$versionOne = $created.Body.data.document
if ($versionOne.currentVersion -ne 1 -or -not $versionOne.isActive -or $versionOne.versions[-1].status -ne "READY") {
  throw "Initial document did not become active version 1."
}

$supportedOne = Ask $citizenToken "For the Phase 16 academic verification scenario, what room, day, and time are demo applications accepted?"
if ($supportedOne.abstained -or @($supportedOne.citations).Count -lt 1) {
  throw "The supported version 1 question did not return a grounded citation."
}
if ($supportedOne.answer -notmatch "A-16" -or $supportedOne.answer -notmatch "Tuesday") {
  throw "The supported version 1 answer did not contain the expected synthetic facts."
}

$unsupported = Ask $citizenToken "According to the authorized documents, what is the Mayor's private mobile telephone number?"
if (-not $unsupported.abstained -or @($unsupported.citations).Count -ne 0) {
  throw "The unsupported private-information question did not abstain cleanly."
}

$versioned = Invoke-DocumentUpload -Path "/api/v1/knowledge/documents/$documentId/versions" -Token $adminToken -Title $title -VersionNote "Synthetic academic verification version 2" -FilePath $fixtureV2
Assert-Status $versioned 201 "Version 2 ingestion"
$versionTwo = $versioned.Body.data.document
if ($versionTwo.currentVersion -ne 2 -or @($versionTwo.versions).Count -ne 2 -or $versionTwo.versions[-1].status -ne "READY") {
  throw "The document did not trace and activate version 2."
}
$supportedTwo = Ask $citizenToken "For the revised Phase 16 academic verification scenario, what room, day, and time are demo applications accepted?"
if ($supportedTwo.abstained -or $supportedTwo.answer -notmatch "B-17" -or $supportedTwo.answer -notmatch "Wednesday") {
  throw "The revised question did not use the active version 2 facts."
}

$deactivated = Invoke-LocalApi -Method POST -Path "/api/v1/knowledge/documents/$documentId/deactivate" -Token $adminToken
Assert-Status $deactivated 200 "Document deactivation"
if ($deactivated.Body.data.document.isActive) { throw "The document remained active after deactivation." }
$afterDeactivation = Ask $citizenToken "For the revised Phase 16 academic verification scenario, where are demo applications accepted?"
if (-not $afterDeactivation.abstained) { throw "The inactive document still supported a new answer." }

$reactivated = Invoke-DocumentUpload -Path "/api/v1/knowledge/documents/$documentId/versions" -Token $adminToken -Title $title -VersionNote "Reactivated synthetic version for browser verification" -FilePath $fixtureV2
Assert-Status $reactivated 201 "Version 3 reactivation"
$versionThree = $reactivated.Body.data.document
if ($versionThree.currentVersion -ne 3 -or -not $versionThree.isActive -or @($versionThree.versions).Count -ne 3) {
  throw "The document did not reactivate as traceable version 3."
}
$finalSupported = Ask $citizenToken "What verification phrase is listed for the revised Phase 16 academic scenario?"
if ($finalSupported.abstained -or $finalSupported.answer -notmatch "INDIGO-517" -or @($finalSupported.citations).Count -lt 1) {
  throw "The reactivated document did not return the expected grounded answer."
}

$adminList = Invoke-LocalApi -Method GET -Path "/api/v1/knowledge/documents" -Token $adminToken
Assert-Status $adminList 200 "Administrator document list"
$listed = $adminList.Body.data.documents | Where-Object { $_.id -eq $documentId } | Select-Object -First 1
if ($null -eq $listed -or @($listed.versions).Count -ne 3) { throw "Version history was not returned to the Administrator." }

[pscustomobject]@{
  documentId = $documentId
  ragReachable = [bool]$rag.reachable
  providerConfigured = [bool]$rag.providerConfigured
  unauthenticatedQueryStatus = $unauthenticated.Status
  departmentQueryStatus = $departmentQuery.Status
  citizenDocumentListStatus = $citizenDocuments.Status
  versionOneReady = ($versionOne.versions[-1].status -eq "READY")
  versionOneGrounded = (-not $supportedOne.abstained -and @($supportedOne.citations).Count -gt 0)
  unsupportedAbstained = [bool]$unsupported.abstained
  versionTwoReady = ($versionTwo.versions[-1].status -eq "READY")
  versionTwoUsedNewFacts = ($supportedTwo.answer -match "B-17")
  inactiveDocumentAbstained = [bool]$afterDeactivation.abstained
  reactivatedVersion = $versionThree.currentVersion
  finalGrounded = (-not $finalSupported.abstained -and @($finalSupported.citations).Count -gt 0)
  tracedVersionCount = @($listed.versions).Count
} | ConvertTo-Json -Compress
