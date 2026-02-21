const request = require('supertest');
const app = require('./server');
const { getManagerToken } = require('./tests/helpers/auth-helper');

async function test() {
  const token = await getManagerToken();
  const res = await request(app).get('/api/admin/approvals').set('x-access-token', token);
  console.log(res.status, res.body);
  process.exit(0);
}
test();
