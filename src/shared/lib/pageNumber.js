export const pageNumber = index => String(index + 1).padStart(3, '0')
export const textSummary = text => text?.trim() ? text.slice(0, 80) : '尚未填写文案'
