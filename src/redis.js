import Redis from 'ioredis';
import { randomBytes } from 'node:crypto';
import { RedisMemoryServer } from 'redis-memory-server';

let redis;
let redisServer;

const TTL_SESSAO = 60 * 60;
const FORMATO_ID = /^[a-f0-9]{64}$/;

function chaveDaSessao(sessionId) {
    return `sessao:${sessionId}`;
}

export async function connectToRedis() {
    redisServer = new RedisMemoryServer();

    const host = await redisServer.getHost();
    const port = await redisServer.getPort();

    let redisUrl = `redis://${host}:${port}`;

    redis = new Redis(redisUrl);

    try {
        await redis.ping();
        console.log("Redis Conectado!");
    } catch (err) {
        console.error("Erro ao conectar ao Redis:", err);
        throw err;
    }
}

// CREATE //
export async function criarSessao(usuario) {
    const sessionId = randomBytes(32).toString('hex');

    await redis.set(
        chaveDaSessao(sessionId),
        JSON.stringify(usuario),
        'EX', TTL_SESSAO
    );

    return sessionId;
}

// READ //
export async function getSessao(sessionId) {
    if (typeof sessionId !== 'string' || !FORMATO_ID.test(sessionId)) {
        return null;
    }

    const chave = chaveDaSessao(sessionId);

    const [[errGet, dados], [errExpire]] = await redis
        .pipeline()
        .get(chave)
        .expire(chave, TTL_SESSAO)
        .exec();

    if (errGet) throw errGet;
    if (errExpire) throw errExpire;

    return dados ? JSON.parse(dados) : null;
}

// DELETE //
export async function deleteSessao(sessionId) {
    if (typeof sessionId !== 'string' || !FORMATO_ID.test(sessionId)) {
        return;
    }

    await redis.del(chaveDaSessao(sessionId));
}