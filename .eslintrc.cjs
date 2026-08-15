module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: 'detect' } },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: ['react', 'react-hooks', '@typescript-eslint', 'jsx-a11y'],
  rules: {
    'react/react-in-jsx-scope': 'off',

    // TẮT CÓ CHỦ ĐÍCH — đây là quyết định chính sách, không phải "đã sửa".
    //
    // Repo thuần JS và chưa bao giờ phụ thuộc `prop-types`: luật này kêu ở 271
    // chỗ, tức là chưa từng có tệp nào thoả mãn nó. Khai đủ 271 chỗ sẽ tạo ra
    // một khối mã soạn tay không ai bảo trì, và cũng chỉ cảnh báo lúc chạy ở
    // chế độ dev chứ không chặn được gì khi build.
    //
    // Muốn thật sự an toàn kiểu dữ liệu thì đường đi là TypeScript (đã có sẵn
    // `packages/ui/src/index.tsx`), không phải PropTypes. Đến khi đó, để luật
    // này bật chỉ khiến CI đỏ vĩnh viễn và che mất lỗi thật.
    'react/prop-types': 'off',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    {
      files: ['services/**'],
      env: { node: true },
    },
    {
      files: ['apps/**'],
      env: { browser: true },
    },
    {
      // Các script là CommonJS thuần. Luật no-var-requires sinh ra để chặn
      // `require()` lọt vào mã TypeScript, nhưng ở đây nó kêu trên mọi tệp .js
      // đúng chuẩn — hơn 40 lỗi giả làm chìm mất lỗi thật.
      //
      // `services/**/*.ts` cũng được miễn, nhưng vì LÝ DO KHÁC: những require()
      // còn sót lại trong service đều là require CÓ ĐIỀU KIỆN, nằm trong
      // try/catch (observability, authMiddleware) hoặc chỉ chạy vì tác dụng phụ
      // (source-map-support, dotenv). Chuyển chúng thành `import` là đổi hành vi
      // — import bị nâng lên đầu và ném lỗi lúc nạp module, đúng thứ mà các
      // try/catch đó sinh ra để tránh.
      files: ['**/*.js', '**/*.cjs', 'services/**/*.ts'],
      rules: { '@typescript-eslint/no-var-requires': 'off' },
    },
    {
      files: ['**/test/**', '**/*.test.js', '**/*.spec.js'],
      env: { jest: true, node: true },
    },
  ],
};
