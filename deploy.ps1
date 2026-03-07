# 아이온2 쌀먹관리기 GitHub 푸시 스크립트 (PowerShell)

$gitPath = "c:\opt\git\bin\git.exe"
$repoUrl = "https://github.com/yulxwell/aion2-manager.git"

Write-Host "아이온2 쌀먹관리기 업로드를 시작합니다..." -ForegroundColor Cyan

# 1. 저장소 연결 상태 확인
Write-Host "`n[1/2] 저장소 연결 확인 중..."
$remote = & $gitPath remote get-url origin 2>$null
if ($null -eq $remote) {
    Write-Host "새로운 원격 저장소를 추가합니다: $repoUrl"
    & $gitPath remote add origin $repoUrl
}
elseif ($remote -ne $repoUrl) {
    Write-Host "기존 원격 저장소 주소를 변경합니다: $repoUrl"
    & $gitPath remote set-url origin $repoUrl
}
else {
    Write-Host "원격 저장소가 이미 올바르게 설정되어 있습니다."
}

# 2. 푸시 실행
Write-Host "`n[2/2] GitHub로 코드 업로드 중..."
Write-Host "(로그인 창이 뜨면 GitHub 계정(yulxwell)으로 로그인해주세요)" -ForegroundColor Yellow

& $gitPath push -u origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ 업로드 완료!" -ForegroundColor Green
    Write-Host "잠시 후 아래 주소에서 확인하실 수 있습니다:"
    Write-Host "https://github.com/yulxwell/aion2-manager" -ForegroundColor Blue
}
else {
    Write-Host "`n❌ 업로드 중 오류가 발생했습니다." -ForegroundColor Red
    Write-Host "GitHub 저장소가 생성되었는지, 그리고 로그인 정보가 올바른지 확인해주세요."
}

Write-Host "`n계속하려면 아무 키나 누르세요..."
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
