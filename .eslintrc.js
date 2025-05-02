module.exports = {
  extends: "next/core-web-vitals",
  rules: {
    // 의존성 배열 관련 규칙 비활성화
    "react-hooks/exhaustive-deps": "off",
    // 사용하지 않는 변수 경고로 변경
    "@typescript-eslint/no-unused-vars": "warn",
  },
};
