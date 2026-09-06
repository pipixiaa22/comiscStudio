function result(work) {
  return Promise.resolve().then(work).then(data => ({ ok: true, data })).catch(error => {
    console.error(error)
    return { ok: false, error: { code: 'PROJECT_ERROR', message: '项目保存或读取失败，请重试。' } }
  })
}

module.exports = { result }
