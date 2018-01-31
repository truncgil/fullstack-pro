import 'reflect-metadata';
require('dotenv').config({ path: process.env.ENV_FILE });

const Hemera = require('nats-hemera');
const HemeraJoi = require('hemera-joi');
const ContainerHemera = require('@sample-stack/microservice-hemera-plugin');

// const HemeraZipkin = require('hemera-zipkin');

const nats = require('nats').connect({
    'url': process.env.NATS_URL,
    'user': process.env.NATS_USER,
    'pass': process.env.NATS_PW,
});

const hemera = new Hemera(nats, {
    logLevel: 'trace',
    childLogger: true,
    tag: 'hemera-server',
    timeout: 10000,
});

hemera.use(HemeraJoi);

hemera.use(ContainerHemera, {
    email: process.env.CLOUDFLARE_EMAIL,
    key: process.env.CLOUDFLARE_KEY,
    zone: process.env.CLOUDFLARE_ZONE_ID,
});

// hemera.setOption('payloadValidator', 'hemera-joi');

hemera.ready(() => {
    // let Joi = hemera.exposition['hemera-joi'].joi;


});

