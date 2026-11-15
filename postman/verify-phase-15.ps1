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
  if ($Token) { $parameters.Headers = @{ Authorization = "Bearer $Token" } }
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

function Get-Notifications([string]$token) {
  $response = Invoke-LocalApi -Method GET -Path "/api/v1/notifications?page=1&pageSize=100&unreadOnly=false" -Token $token
  Assert-Status $response 200 "Notification list"
  return @($response.Body.data.items)
}

function Wait-ForNotification {
  param(
    [string]$Token,
    [string]$ComplaintId,
    [string]$EventType
  )
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    $match = Get-Notifications $Token |
      Where-Object { $_.complaintId -eq $ComplaintId -and $_.eventType -eq $EventType } |
      Select-Object -First 1
    if ($null -ne $match) { return $match }
    Start-Sleep -Milliseconds 500
  }
  throw "Notification $EventType for complaint $ComplaintId was not created within 10 seconds."
}

function Wait-ForRecommendation([string]$complaintId, [string]$adminToken) {
  for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
    $response = Invoke-LocalApi -Method GET -Path "/api/v1/admin/classifications/$complaintId" -Token $adminToken
    Assert-Status $response 200 "Classification detail"
    if ($null -ne $response.Body.data.recommendation) { return }
    Start-Sleep -Milliseconds 1000
  }
  throw "The AI classification attempt did not finish within 40 seconds."
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

$accountsResponse = Invoke-LocalApi -Method GET -Path "/api/v1/admin/department-accounts" -Token $adminToken
$mappingsResponse = Invoke-LocalApi -Method GET -Path "/api/v1/admin/category-mappings" -Token $adminToken
$departmentsResponse = Invoke-LocalApi -Method GET -Path "/api/v1/admin/departments" -Token $adminToken
Assert-Status $accountsResponse 200 "Department Account list"
Assert-Status $mappingsResponse 200 "Category mapping list"
Assert-Status $departmentsResponse 200 "Department list"

$sourceAccount = $accountsResponse.Body.data.accounts |
  Where-Object { $_.user.email -eq $postmanValues["department_account_email"] } |
  Select-Object -First 1
if ($null -eq $sourceAccount) { throw "The source Department Account mapping was not found." }
$sourceDepartmentId = $sourceAccount.departmentId
$sourceMapping = $mappingsResponse.Body.data.mappings |
  Where-Object { $_.isActive -and $_.departmentId -eq $sourceDepartmentId } |
  Select-Object -First 1
if ($null -eq $sourceMapping) { throw "No active category routes to the source Department Account." }

$targetDepartment = $departmentsResponse.Body.data.departments |
  Where-Object { $_.code -eq "PHASE14_VERIFICATION" } |
  Select-Object -First 1
if ($null -eq $targetDepartment) { throw "Run Phase 14 live verification before Phase 15." }
$targetAccount = $accountsResponse.Body.data.accounts |
  Where-Object { $_.departmentId -eq $targetDepartment.id } |
  Select-Object -First 1
if ($null -eq $targetAccount) { throw "The Phase 14 target Department Account was not found." }
$targetDepartmentSession = Login $targetAccount.user.email $postmanValues["department_account_password"]
$targetToken = $targetDepartmentSession.tokens.accessToken

$targetPreferenceOff = Invoke-LocalApi -Method PUT -Path "/api/v1/notifications/preferences/me" -Token $targetToken -Body @{ inAppEnabled = $false }
Assert-Status $targetPreferenceOff 200 "Disable target in-app preference"

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$created = Invoke-LocalApi -Method POST -Path "/api/v1/complaints" -Token $citizenToken -Body @{
  title = "Phase 15 notification verification $stamp"
  description = "This clearly labelled local test complaint verifies durable notification events, recipient isolation, read state, and preferences."
  categoryId = $sourceMapping.categoryId
}
Assert-Status $created 201 "Complaint creation"
$complaint = $created.Body.data.complaint
$complaintId = $complaint.id
$submittedNotification = Wait-ForNotification -Token $citizenToken -ComplaintId $complaintId -EventType "COMPLAINT_SUBMITTED"

Wait-ForRecommendation $complaintId $adminToken
$reviewed = Invoke-LocalApi -Method POST -Path "/api/v1/admin/classifications/$complaintId/review" -Token $adminToken -Body @{
  categoryId = $sourceMapping.categoryId
  version = $complaint.version
  reason = "Phase 15 verification retains the configured source department for event testing."
}
Assert-Status $reviewed 200 "Classification review"
$citizenAssigned = Wait-ForNotification -Token $citizenToken -ComplaintId $complaintId -EventType "COMPLAINT_ASSIGNED"
$departmentAssigned = Wait-ForNotification -Token $sourceToken -ComplaintId $complaintId -EventType "COMPLAINT_ASSIGNED"

$sourceComplaint = Invoke-LocalApi -Method GET -Path "/api/v1/complaints/$complaintId" -Token $sourceToken
Assert-Status $sourceComplaint 200 "Source complaint detail"
$statusChanged = Invoke-LocalApi -Method PATCH -Path "/api/v1/complaints/$complaintId/status" -Token $sourceToken -Body @{
  status = "UNDER_REVIEW"
  version = $sourceComplaint.Body.data.complaint.version
}
Assert-Status $statusChanged 200 "Complaint status change"
$citizenStatus = Wait-ForNotification -Token $citizenToken -ComplaintId $complaintId -EventType "COMPLAINT_STATUS_CHANGED"

$firstRequest = Invoke-LocalApi -Method POST -Path "/api/v1/reassignments" -Token $sourceToken -Body @{
  complaintId = $complaintId
  reason = "Phase 15 verification creates a rejection event for the requesting department."
}
Assert-Status $firstRequest 201 "First reassignment request"
$firstRequestId = $firstRequest.Body.data.reassignment.id
$adminRequested = Wait-ForNotification -Token $adminToken -ComplaintId $complaintId -EventType "REASSIGNMENT_REQUESTED"
$firstDecision = Invoke-LocalApi -Method POST -Path "/api/v1/reassignments/$firstRequestId/decision" -Token $adminToken -Body @{
  decision = "REJECTED"
  decisionReason = "Rejected intentionally for Phase 15 notification recipient verification."
}
Assert-Status $firstDecision 200 "Reassignment rejection"
$departmentRejected = Wait-ForNotification -Token $sourceToken -ComplaintId $complaintId -EventType "REASSIGNMENT_REJECTED"

$secondRequest = Invoke-LocalApi -Method POST -Path "/api/v1/reassignments" -Token $sourceToken -Body @{
  complaintId = $complaintId
  reason = "Phase 15 verification creates an approval event while the target preference is disabled."
}
Assert-Status $secondRequest 201 "Second reassignment request"
$secondRequestId = $secondRequest.Body.data.reassignment.id
$secondDecision = Invoke-LocalApi -Method POST -Path "/api/v1/reassignments/$secondRequestId/decision" -Token $adminToken -Body @{
  decision = "APPROVED"
  targetDepartmentId = $targetDepartment.id
  decisionReason = "Approved for Phase 15 preference and reassignment notification verification."
}
Assert-Status $secondDecision 200 "Reassignment approval to target"
$citizenApproved = Wait-ForNotification -Token $citizenToken -ComplaintId $complaintId -EventType "REASSIGNMENT_APPROVED"
$sourceApproved = Wait-ForNotification -Token $sourceToken -ComplaintId $complaintId -EventType "REASSIGNMENT_APPROVED"
Start-Sleep -Milliseconds 1000
$targetWhileDisabled = @(Get-Notifications $targetToken | Where-Object { $_.complaintId -eq $complaintId })
if ($targetWhileDisabled.Count -ne 0) { throw "The disabled target preference still created a notification." }

$targetPreferenceOn = Invoke-LocalApi -Method PUT -Path "/api/v1/notifications/preferences/me" -Token $targetToken -Body @{ inAppEnabled = $true }
Assert-Status $targetPreferenceOn 200 "Enable target in-app preference"
$thirdRequest = Invoke-LocalApi -Method POST -Path "/api/v1/reassignments" -Token $targetToken -Body @{
  complaintId = $complaintId
  reason = "Phase 15 verification returns the complaint after re-enabling target notifications."
}
Assert-Status $thirdRequest 201 "Third reassignment request"
$thirdRequestId = $thirdRequest.Body.data.reassignment.id
$thirdDecision = Invoke-LocalApi -Method POST -Path "/api/v1/reassignments/$thirdRequestId/decision" -Token $adminToken -Body @{
  decision = "APPROVED"
  targetDepartmentId = $sourceDepartmentId
  decisionReason = "Approved to verify enabled requester and destination notification delivery."
}
Assert-Status $thirdDecision 200 "Reassignment approval to source"
$targetEnabledNotification = Wait-ForNotification -Token $targetToken -ComplaintId $complaintId -EventType "REASSIGNMENT_APPROVED"

$crossRecipientRead = Invoke-LocalApi -Method PATCH -Path "/api/v1/notifications/$($submittedNotification.id)/read" -Token $sourceToken
Assert-Status $crossRecipientRead 404 "Cross-recipient notification read"
$unauthenticated = Invoke-LocalApi -Method GET -Path "/api/v1/notifications"
Assert-Status $unauthenticated 401 "Unauthenticated notification list"

$countBefore = Invoke-LocalApi -Method GET -Path "/api/v1/notifications/unread-count" -Token $citizenToken
Assert-Status $countBefore 200 "Unread count before mark-one"
$markedOne = Invoke-LocalApi -Method PATCH -Path "/api/v1/notifications/$($submittedNotification.id)/read" -Token $citizenToken
Assert-Status $markedOne 200 "Owned notification read"
$countAfterOne = Invoke-LocalApi -Method GET -Path "/api/v1/notifications/unread-count" -Token $citizenToken
Assert-Status $countAfterOne 200 "Unread count after mark-one"
if ($countAfterOne.Body.data.unreadCount -ne ($countBefore.Body.data.unreadCount - 1)) {
  throw "Mark-one did not decrement the Citizen unread count by one."
}
$markedAll = Invoke-LocalApi -Method POST -Path "/api/v1/notifications/read-all" -Token $citizenToken
Assert-Status $markedAll 200 "Mark all Citizen notifications read"
$countAfterAll = Invoke-LocalApi -Method GET -Path "/api/v1/notifications/unread-count" -Token $citizenToken
Assert-Status $countAfterAll 200 "Unread count after mark-all"
if ($countAfterAll.Body.data.unreadCount -ne 0) { throw "Mark-all did not clear Citizen unread notifications." }

[pscustomobject]@{
  complaintId = $complaintId
  submittedDelivered = [bool]$submittedNotification
  citizenAssignedDelivered = [bool]$citizenAssigned
  departmentAssignedDelivered = [bool]$departmentAssigned
  citizenStatusDelivered = [bool]$citizenStatus
  administratorRequestDelivered = [bool]$adminRequested
  departmentRejectionDelivered = [bool]$departmentRejected
  citizenApprovalDelivered = [bool]$citizenApproved
  sourceApprovalDelivered = [bool]$sourceApproved
  disabledTargetNotificationCount = $targetWhileDisabled.Count
  enabledTargetDelivered = [bool]$targetEnabledNotification
  crossRecipientReadStatus = $crossRecipientRead.Status
  unauthenticatedStatus = $unauthenticated.Status
  unreadBefore = $countBefore.Body.data.unreadCount
  unreadAfterOne = $countAfterOne.Body.data.unreadCount
  unreadAfterAll = $countAfterAll.Body.data.unreadCount
} | ConvertTo-Json -Compress
