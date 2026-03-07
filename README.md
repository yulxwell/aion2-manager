# 아이온2 쌀먹관리기 (Aion2 RMT Manager)

아이온2의 다양한 티켓(정복티켓, 오드에너지, 초월, 악몽, 슈고페스타) 충전 상태를 실시간으로 관리하는 웹 도구입니다.

## 🚀 서비스 접속 (모바일/PC)
이 프로젝트는 GitHub Pages를 통해 배포됩니다.
- **주소**: `https://[사용자ID].github.io/aion2-manager/`

## ✨ 주요 기능
- **실시간 충전 계산**: KST 기준 충전 주기(5시, 13시, 21시 등)에 맞춰 남은 시간 및 다음 충전 시각 표시
- **리밋 도달 시간**: 최대 티켓 수(Max)에 도달하는 시각을 예측하여 표시
- **캐릭터 관리**: 계정별 캐릭터 추가/삭제 및 순서 조정(Up/Down) 기능
- **자동 저장**: 브라우저의 `localStorage`를 사용하여 데이터를 안전하게 보관

## 🛠 유지보수 및 업데이트
코드를 수정한 후 GitHub에 푸시하면 자동으로 배포가 업데이트됩니다.
```bash
# 로컬에서 업데이트 시
c:\opt\git\bin\git.exe add .
c:\opt\git\bin\git.exe commit -m "상태 업데이트 내용"
c:\opt\git\bin\git.exe push origin master
```
 see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
