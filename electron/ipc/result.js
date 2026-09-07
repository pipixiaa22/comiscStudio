function result(work) {
  return Promise.resolve().then(work).then(data => ({ ok: true, data })).catch(error => {
    console.error(error)
    const message = error instanceof Error && error.message ? error.message : '操作失败，请重试。'
    return { ok: false, error: { code: error?.code || 'PROJECT_ERROR', message } }
  })
}

module.exports = { result }
