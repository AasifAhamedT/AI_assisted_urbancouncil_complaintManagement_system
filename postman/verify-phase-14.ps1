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
  }
  if ($Token) {
    $parameters.Headers = @{ Authorization = "Bearer $Token" }
  }
  if ($null -ne $Body) {
    $parameters.ContentType = "application/json"
    $parameters.Body = $Body | ConvertTo-Json -Depth 8 -Compress
  }
  $response = Invoke-WebRequest @parameters
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

function Wait-ForRecommendation([string]$complaintId, [string]$adminToken) {
  for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
    $response = Invoke-LocalApi -Method GET -Path "/api/v1/admin/classifications/$complaintId" -Token $adminToken
    Assert-Status $response 200 "Classification detail"
    if ($null -ne $response.Body.data.recommendation) {
      return
    }
    Start-Sleep -Milliseconds 1000
  }
  throw "The AI classification attempt did not finish within 40 seconds."
}

function Create-ReviewedComplaint {
  param(
    [string]$CitizenToken,
    [string]$AdminToken,
    [string]$CategoryId,
    [string]$Title,
    [string]$Description
  )
  $created = Invoke-LocalApi -Method POST -Path "/api/v1/complaints" -Token $CitizenToken -Body @{
    title = $Title
    description = $Description
    categoryId = $CategoryId
  }
  Assert-Status $created 201 "Complaint creation"
  $complaint = $created.Body.data.complaint
  Wait-ForRecommendation $complaint.id $AdminToken
  $reviewed = Invoke-LocalApi -Method POST -Path "/api/v1/admin/classifications/$($complaint.id)/review" -Token $AdminToken -Body @{
    categoryId = $CategoryId
    version = $complaint.version
    reason = "Phase 14 verification keeps this test complaint in the authenticated source department."
  }
  Assert-Status $reviewed 200 "Classification review"
  $detail = Invoke-LocalApi -Method GET -Path "/api/v1/complaints/$($complaint.id)" -Token $AdminToken
  Assert-Status $detail 200 "Reviewed complaint detail"
  return $detail.Body.data.complaint
}

$postmanPath = Join-Path $repositoryRoot "postman/Smart Urban Council API Tests.postman_environment.json"
$bootstrapPath = Join-Path $repositoryRoot "apps/api/.env.bootstrap"
$postman = Get-Content -LiteralPath $postmanPath -Raw | ConvertFrom-Json
$postmanValues = @{}
$postman.values | ForEach-Object { $postmanValues[$_.key] = [string]$_.value }
$bootstrap = Read-KeyValueFile $bootstrapPath

$admin = Login $bootstrap["ADMIN_BOOTSTRAP_EMAIL"] $bootstrap["ADMIN_BOOTSTRAP_PASSWORD"]
$sourceDepartment = Login $postmanValues["department_account_email"] $postmanValues["department_account_password"]
$citizen = Login $postmanValues["citizen_email"] $postmanValues["citizen_password"]
$adminToken = $admin.tokens.accessToken
$sourceToken = $sourceDepartment.tokens.accessToken
$citizenToken = $citizen.tokens.accessToken

$departmentsResponse = Invoke-LocalApi -Method GET -Path "/api/v1/admin/departments" -Token $adminToken
$accountsResponse = Invoke-LocalApi -Method GET -Path "/api/v1/admin/department-accounts" -Token $adminToken
$mappingsResponse = Invoke-LocalApi -Method GET -Path "/api/v1/admin/category-mappings" -Token $adminToken
Assert-Status $departmentsResponse 200 "Department list"
Assert-Status $accountsResponse 200 "Department Account list"
Assert-Status $mappingsResponse 200 "Category mapping list"

$sourceAccount = $accountsResponse.Body.data.accounts |
  Where-Object { $_.user.email -eq $postmanValues["department_account_email"] } |
  Select-Object -First 1
if ($null -eq $sourceAccount) { throw "The source Department Account mapping was not found." }
$sourceDepartmentId = $sourceAccount.departmentId
$sourceMapping = $mappingsResponse.Body.data.mappings |
  Where-Object { $_.isActive -and $_.departmentId -eq $sourceDepartmentId } |
  Select-Object -First 1
if ($null -eq $sourceMapping) { throw "No active category routes to the source Department Account." }

$targetCode = "PHASE14_VERIFICATION"
$target = $departmentsResponse.Body.data.departments |
  Where-Object { $_.code -eq $targetCode } |
  Select-Object -First 1
if ($null -eq $target) {
  $createdTarget = Invoke-LocalApi -Method POST -Path "/api/v1/admin/departments" -Token $adminToken -Body @{
    code = $targetCode
    name = "Phase 14 Verification Department"
    description = "Local development record used only for reassignment isolation verification."
  }
  Assert-Status $createdTarget 201 "Target department creation"
  $target = $createdTarget.Body.data.department
}

$accountsResponse = Invoke-LocalApi -Method GET -Path "/api/v1/admin/department-accounts" -Token $adminToken
Assert-Status $accountsResponse 200 "Refreshed Department Account list"
$targetAccount = $accountsResponse.Body.data.accounts |
  Where-Object { $_.departmentId -eq $target.id } |
  Select-Object -First 1
$targetEmail = "phase14.verification.department@example.test"
if ($null -eq $targetAccount) {
  $createdAccount = Invoke-LocalApi -Method POST -Path "/api/v1/admin/department-accounts" -Token $adminToken -Body @{
    departmentId = $target.id
    email = $targetEmail
    password = $postmanValues["department_account_password"]
    displayName = "Phase 14 Verification Department"
  }
  Assert-Status $createdAccount 201 "Target Department Account creation"
} elseif ($targetAccount.user.status -ne "ACTIVE") {
  $activated = Invoke-LocalApi -Method PATCH -Path "/api/v1/admin/department-accounts/$($targetAccount.userId)/status" -Token $adminToken -Body @{ status = "ACTIVE" }
  Assert-Status $activated 204 "Target Department Account activation"
  $targetEmail = $targetAccount.user.email
} else {
  $targetEmail = $targetAccount.user.email
}
$targetDepartment = Login $targetEmail $postmanValues["department_account_password"]
$targetToken = $targetDepartment.tokens.accessToken

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$approvalComplaintParameters = @{
  CitizenToken = $citizenToken
  AdminToken = $adminToken
  CategoryId = $sourceMapping.categoryId
  Title = "Phase 14 approval verification $stamp"
  Description = "This clearly labelled local test complaint verifies approved reassignment and strict department isolation."
}
$approvalComplaint = Create-ReviewedComplaint @approvalComplaintParameters

$approvalRequest = Invoke-LocalApi -Method POST -Path "/api/v1/reassignments" -Token $sourceToken -Body @{
  complaintId = $approvalComplaint.id
  reason = "Phase 14 verification requests transfer to the dedicated target department."
}
Assert-Status $approvalRequest 201 "Reassignment request"
$requestId = $approvalRequest.Body.data.reassignment.id

$duplicate = Invoke-LocalApi -Method POST -Path "/api/v1/reassignments" -Token $sourceToken -Body @{
  complaintId = $approvalComplaint.id
  reason = "This duplicate request must be rejected by the pending-request database guard."
}
Assert-Status $duplicate 409 "Duplicate pending request"

$citizenDenied = Invoke-LocalApi -Method GET -Path "/api/v1/reassignments" -Token $citizenToken
$unauthenticated = Invoke-LocalApi -Method GET -Path "/api/v1/reassignments"
$targetRequestDenied = Invoke-LocalApi -Method GET -Path "/api/v1/reassignments/$requestId" -Token $targetToken
Assert-Status $citizenDenied 403 "Citizen reassignment access"
Assert-Status $unauthenticated 401 "Unauthenticated reassignment access"
Assert-Status $targetRequestDenied 404 "Other-department reassignment access"

$approved = Invoke-LocalApi -Method POST -Path "/api/v1/reassignments/$requestId/decision" -Token $adminToken -Body @{
  decision = "APPROVED"
  targetDepartmentId = $target.id
  decisionReason = "Approved for Phase 14 verification of the assignment transaction and isolation policy."
}
Assert-Status $approved 200 "Reassignment approval"

$sourceAfterApproval = Invoke-LocalApi -Method GET -Path "/api/v1/complaints/$($approvalComplaint.id)" -Token $sourceToken
$targetAfterApproval = Invoke-LocalApi -Method GET -Path "/api/v1/complaints/$($approvalComplaint.id)" -Token $targetToken
$repeatDecision = Invoke-LocalApi -Method POST -Path "/api/v1/reassignments/$requestId/decision" -Token $adminToken -Body @{
  decision = "REJECTED"
  decisionReason = "A completed request must not accept a second decision."
}
Assert-Status $sourceAfterApproval 404 "Old-department complaint access"
Assert-Status $targetAfterApproval 200 "New-department complaint access"
Assert-Status $repeatDecision 409 "Repeated decision"
if ($targetAfterApproval.Body.data.complaint.status -ne $approvalComplaint.status) {
  throw "Reassignment incorrectly changed complaint processing status."
}

$rejectionComplaintParameters = @{
  CitizenToken = $citizenToken
  AdminToken = $adminToken
  CategoryId = $sourceMapping.categoryId
  Title = "Phase 14 rejection verification $stamp"
  Description = "This clearly labelled local test complaint verifies rejection without changing the current department assignment."
}
$rejectionComplaint = Create-ReviewedComplaint @rejectionComplaintParameters
$rejectionRequest = Invoke-LocalApi -Method POST -Path "/api/v1/reassignments" -Token $sourceToken -Body @{
  complaintId = $rejectionComplaint.id
  reason = "Phase 14 verification submits a request that the Administrator will reject."
}
Assert-Status $rejectionRequest 201 "Rejection-path request"
$rejectionRequestId = $rejectionRequest.Body.data.reassignment.id
$rejected = Invoke-LocalApi -Method POST -Path "/api/v1/reassignments/$rejectionRequestId/decision" -Token $adminToken -Body @{
  decision = "REJECTED"
  decisionReason = "Rejected intentionally to verify that assignment remains unchanged."
}
Assert-Status $rejected 200 "Reassignment rejection"
$sourceAfterRejection = Invoke-LocalApi -Method GET -Path "/api/v1/complaints/$($rejectionComplaint.id)" -Token $sourceToken
$targetAfterRejection = Invoke-LocalApi -Method GET -Path "/api/v1/complaints/$($rejectionComplaint.id)" -Token $targetToken
Assert-Status $sourceAfterRejection 200 "Source access after rejection"
Assert-Status $targetAfterRejection 404 "Other-department access after rejection"

[pscustomobject]@{
  approvalComplaintId = $approvalComplaint.id
  approvalRequestId = $requestId
  approvalStatusPreserved = $targetAfterApproval.Body.data.complaint.status
  duplicateRequestStatus = $duplicate.Status
  citizenDeniedStatus = $citizenDenied.Status
  unauthenticatedStatus = $unauthenticated.Status
  oldDepartmentAfterApproval = $sourceAfterApproval.Status
  newDepartmentAfterApproval = $targetAfterApproval.Status
  repeatedDecisionStatus = $repeatDecision.Status
  rejectionComplaintId = $rejectionComplaint.id
  rejectionRequestId = $rejectionRequestId
  sourceAfterRejection = $sourceAfterRejection.Status
  otherDepartmentAfterRejection = $targetAfterRejection.Status
} | ConvertTo-Json -Compress
