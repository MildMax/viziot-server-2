
const todoApi = require('../api/todo/index')
const tcpDataApi = require('../api/tcpData/index')

const API_V1 = '/api/v1'

module.exports = app => {
  app.get(API_V1, (req, res) => {
    res.json({ version: 1 })
  })

  app.use(API_V1, todoApi)
  app.use(API_V1, tcpDataApi)
}
