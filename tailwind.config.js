const token = name => `hsl(var(--${name}) / <alpha-value>)`

const neutralAliases = {
  50: token('background'), 100: token('foreground'), 200: token('foreground'), 300: token('foreground'),
  400: token('muted-foreground'), 500: token('muted-foreground'), 600: token('input'), 700: token('border'),
  800: token('muted'), 900: token('surface'), 950: token('background')
}

module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: token('background'), foreground: token('foreground'), surface: token('surface'),
        card: token('card'), popover: token('popover'), border: token('border'), input: token('input'), ring: token('ring'),
        selected: token('selected'), scrollbar: token('scrollbar'), overlay: token('overlay'),
        primary: {DEFAULT: token('primary'), foreground: token('primary-foreground'), hover: token('primary-hover')},
        secondary: {DEFAULT: token('secondary'), foreground: token('secondary-foreground')},
        muted: {DEFAULT: token('muted'), foreground: token('muted-foreground')},
        accent: {DEFAULT: token('accent'), foreground: token('accent-foreground')},
        destructive: {DEFAULT: token('destructive'), foreground: token('destructive-foreground')},
        media: {background: token('media-background'), foreground: token('media-foreground')},
        slate: neutralAliases,
        orange: Object.fromEntries([200, 300, 400, 500].map(value => [value, token('primary')])),
        amber: Object.fromEntries([200, 300, 400].map(value => [value, token('foreground')])),
        emerald: Object.fromEntries([200, 300, 400, 500, 700].map(value => [value, token('foreground')])),
        rose: Object.fromEntries([300, 400, 950].map(value => [value, token('destructive')])),
        red: Object.fromEntries([200, 300, 400, 950].map(value => [value, token('destructive')]))
      }
    }
  },
  plugins: []
}
