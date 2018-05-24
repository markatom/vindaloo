const authenticator = require('./authenticator');
const bodyParser = require('koa-bodyparser');
const Koa = require('koa');
const route = require('koa-route');

const start = () => {
    const app = new Koa();

    app.use(bodyParser());
    app.use(route.post('/login', (ctx) => {
        try {
            ctx.response.body = authenticator.login(ctx.request.body.email, ctx.request.body.password);

        } catch (error) {
            ctx.response.status = 401; // unauthorized
        }
    }));

    app.listen(12345); // port number does not matter
};

module.exports = {
    start,
};
