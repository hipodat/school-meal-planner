# 배포 가이드 (GitHub → Vercel)

Next.js 앱이라 Vercel 무료 플랜으로 바로 배포됩니다.

## 1. GitHub에 올리기

1. https://github.com/new 에서 **빈 저장소** 생성
   - 이름 예: `school-meal-planner`
   - ⚠️ "Add a README", ".gitignore", "license" 는 **체크하지 마세요** (빈 상태여야 함)
2. 이 폴더에서 아래 명령 실행 (`<사용자명>` 을 본인 GitHub 아이디로 교체):

```bash
git remote add origin https://github.com/<사용자명>/school-meal-planner.git
git push -u origin main
```

> 푸시할 때 GitHub 로그인(브라우저) 또는 Personal Access Token 입력이 필요합니다.

## 2. Vercel에서 배포

1. https://vercel.com 로그인 (GitHub 계정으로 로그인하면 편함)
2. **Add New → Project** → 방금 만든 GitHub 저장소 **Import**
3. **Environment Variables** 에 아래 항목 추가:
   - Name: `NEIS_KEY`
   - Value: `.env.local` 파일에 있는 나이스 인증키 값
4. **Deploy** 클릭 → 잠시 후 `https://school-meal-planner-xxxx.vercel.app` 공개 URL 발급

## 참고

- `.env.local` 은 깃에 올라가지 않으므로(=.gitignore), 인증키는 반드시 Vercel 환경변수로 등록해야 합니다.
- 이후 코드를 수정하고 `git push` 하면 Vercel이 자동으로 재배포합니다.
- 자동 생성 식단은 서버리스 환경에서 파일로 영구 저장되지 않지만, 생성기가 연·월 시드 기반이라 매번 동일한 식단이 재생성됩니다.
