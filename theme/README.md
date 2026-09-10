# 主题颜色

`tokens.json` 是浅色与深色界面颜色的唯一来源。修改颜色后运行 `pnpm theme:generate`，并在提交前执行 `pnpm theme:check`。

组件只可使用 Tailwind 的语义颜色类，例如 `bg-background`、`text-muted-foreground`、`border-border`。媒体内容与导出底图属于内容数据，不适用这条规则。

`src/shared/theme/tokens.generated.css` 由脚本生成并提交，禁止手动编辑。
