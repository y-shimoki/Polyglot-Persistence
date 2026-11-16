import express from 'express';
import 'dotenv/config';
import * as MongoDB from './src/mongodb.js';
import * as Postgre from './src/postgre.js';
import * as Redis from './src/redis.js';

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// ================= SESSÃO (cookie + Redis) =================
const COOKIE_SESSAO = 'sessionId';
const OPCOES_COOKIE = {
    httpOnly: true,
    sameSite: 'lax',
    secure: false
};

function lerCookie(req, nome) {
    const cabecalho = req.headers.cookie;
    if (!cabecalho) return null;

    for (const par of cabecalho.split(';')) {
        const [chave, ...valor] = par.trim().split('=');
        if (chave === nome) return valor.join('=');
    }
    return null;
}

async function iniciarSessao(req, res, usuario) {
    // se já existia uma sessão neste navegador ela é apagada
    await Redis.deleteSessao(req.sessionId);

    const sessionId = await Redis.criarSessao(usuario);
    res.cookie(COOKIE_SESSAO, sessionId, OPCOES_COOKIE);
}

async function encerrarSessao(req, res) {
    await Redis.deleteSessao(req.sessionId);
    res.clearCookie(COOKIE_SESSAO, OPCOES_COOKIE);
}

app.use(async (req, res, next) => {
    try {
        req.sessionId = lerCookie(req, COOKIE_SESSAO);
        req.usuario = await Redis.getSessao(req.sessionId);
        next();
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar a sessão.');
    }
});

await MongoDB.connectToMongoDB();
await Postgre.connectToPostgreSQL();
await Redis.connectToRedis();

// ================= ROTAS GET (PÁGINAS) =================

// Página 1: Login / Cadastro
app.get('/', (req, res) => {
    res.render('login');
});

// Página 2: Home (Catálogo)
app.get('/home', async (req, res) => {
    try {
        const usuario = req.usuario;
        if (!usuario) return res.redirect('/');

        const livros = await MongoDB.getLivros();
        const isAdmin = usuario.admin === true;

        res.render('home', { 
            livros,
            usuario, 
            isAdmin 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar livros.');
    }
});

// Página do Painel do Administrador
app.get('/admin', async (req, res) => {
    try {
        const usuario = req.usuario;

        if (!usuario || usuario.admin !== true) {
            return res.status(403).send('Acesso negado.');
        }

        const livros = await MongoDB.getLivros();
        res.render('admin', { books: livros, usuario });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar painel do admin.');
    }
});

// Página 3: Perfil do Usuário / Favoritos e Reviews
app.get('/user', async (req, res) => {
    try {
        const usuario = req.usuario;
        if (!usuario) return res.redirect('/');

        const idLivros = await Postgre.getLivrosDoUsuario(usuario.user);

        const livros = await Promise.all(
            idLivros.map(livro => MongoDB.getLivroPorId(livro.bookId))
        );

        const reviews = await MongoDB.getReviewsDoUsuario(usuario.user);

        const reviewsComTitulo = await Promise.all(
            reviews.map(async (rev) => {
                const livro = await MongoDB.getLivroPorId(rev.bookId); 
                return {
                    ...rev.toObject(),
                    tituloLivro: livro ? livro.titulo : 'Livro não existe mais.'
                };
            })
        );

        const isAdmin = usuario.admin === true;

        res.render('user', {
            usuario,
            isAdmin,
            reviews: reviewsComTitulo,
            livros
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar perfil.');
    }
});

// Página 4: Detalhes do Livro
app.get('/book/:id', async (req, res) => {
    try {
        const usuario = req.usuario;
        if (!usuario) return res.redirect('/');

        const bookId = req.params.id;
        const livro = await MongoDB.getLivroPorId(bookId);

        if (!livro) {
            return res.status(404).send('Livro não encontrado.');
        }

        const reviewsDoLivro = await MongoDB.getReviewsDoLivro(bookId);
        const reviewUsuario = await MongoDB.verificarReview(usuario.user, bookId);

        res.render('book', {
            livro: livro,
            reviews: reviewsDoLivro,
            reviewUsuario
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar detalhes do livro.');
    }
});

// Ação: Terminar Sessão (Logout)
app.get('/logout', async (req, res) => {
    try {
        await encerrarSessao(req, res);
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao encerrar a sessão.');
    }
});

// ================= ROTAS POST (AÇÕES) =================

// Ação: Entrar (Login)
app.post('/login', async (req, res) => {
    try {
        const { nome, senha } = req.body;

        // verifica se o login é do administrador antes de consultar o banco:
        if (
            nome === process.env.ADMIN_USER &&
            senha === process.env.ADMIN_PASSWORD
        ) {
            await iniciarSessao(req, res, { user: nome, admin: true });
            return res.redirect('/home');
        }

        const usuario = await Postgre.getUsuario(nome);
        if (!usuario || usuario.senha !== senha) {
            return res.send('Usuário ou senha incorretos.');
        }

        // a senha não é guardada na sessão (nada no app usa e ela ficaria em texto puro no Redis):
        await iniciarSessao(req, res, { user: nome });
        res.redirect('/home');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao realizar login.');
    }
});

// Ação: Criar Conta (Register)
app.post('/register', async (req, res) => {
    try {
        const { nome, senha } = req.body;
        const usuarioExistente = await Postgre.getUsuario(nome);

        if (usuarioExistente || nome === process.env.ADMIN_USER) {
            return res.send('Nome de usuário já existe.');
        }

        await Postgre.cadastrarUsuario(nome, senha);
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao realizar cadastro');
    }
});

// Ação: Favoritar Livro
app.post('/favorite/:id', async (req, res) => {
   try {
        const usuario = req.usuario;
        const bookId = req.params.id;

        const jaFavoritado = await Postgre.verificarPosse(usuario.user, bookId);

        if (jaFavoritado) {
            res.send('Você já favoritou este livro!');
        } else {
            await Postgre.adicionarLivro(usuario.user, bookId);
            res.redirect('/user');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao favoritar livro.');
    }
});

// Ação: Enviar / Atualizar Review
app.post('/review/:id', async (req, res) => {
    try {
        const usuario = req.usuario;
        const bookId = req.params.id;
        const { nota, texto } = req.body;

        const reviewExistente = await MongoDB.verificarReview(usuario.user, bookId);

        const dadosReview = {
            nota: Number(nota) || 5,
            comentario: texto || ''
        };

        if (reviewExistente) {
            await MongoDB.updateReview(usuario.user, bookId, dadosReview);
        } else {
            const novaReview = {
                bookId: bookId,
                user: usuario.user,
                ...dadosReview
            };
            await MongoDB.addReview(novaReview);
        }

        res.redirect(`/book/${bookId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao enviar review.');
    }
});

// Ação: Apagar Review
app.post('/review/delete/:id', async (req, res) => {
    try {
        const usuario = req.usuario;
        const reviewId = req.params.id;

        if (!usuario) {
            return res.status(401).send('Você precisa estar logado.');
        }

        const reviewApagada = await MongoDB.deleteReview(reviewId, usuario.user);

        if (!reviewApagada) {
            return res.status(404).send('Review não encontrada.');
        }

        res.redirect('/user');

    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao apagar review.');
    }
});

// Ação: Excluir conta do usuário
app.post('/user/delete', async (req, res) => {
    try {
        const usuario = req.usuario;

        if (!usuario) {
            return res.redirect('/login');
        }

        // Apaga todas as reviews do usuário no MongoDB
        await MongoDB.deleteReviewsByUser(usuario.user);

        // Apaga os favoritos e a conta do usuário no PostgreSQL
        await Postgre.deleteAccount(usuario.user);

        // Encerra a sessão
        await encerrarSessao(req, res);
        res.redirect('/');

    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao excluir a conta.');
    }
});

// Ação: Remover livro da conta
app.post('/unfavorite/:id', async (req, res) => {
    try {
        const usuario = req.usuario;
        const bookId = req.params.id;

        if (!usuario) {
            return res.redirect('/login');
        }

        await Postgre.removerLivro(usuario.user, bookId);

        res.redirect('/user');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao remover livro da conta.');
    }
});

// função auxiliar para proteção das ações de admin:
function verificarAdmin(req, res, next) {
    if (req.usuario?.admin) {
        return next();
    }
    return res.status(403).send('Acesso permitido apenas ao administrador.');
}

// Ação Admin: Adicionar Novo Livro 
app.post('/admin/add-book', verificarAdmin, async (req, res) => {
    try {
        const { titulo, sinopse, genero, autor } = req.body;

        await MongoDB.addLivro({
            titulo,
            sinopse,
            genero: genero.split(',').map(item => item.trim()).filter(item => item !== ''),
            autor
        });

        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao cadastrar livro');
    }
});

app.post('/admin/update-book/:id', verificarAdmin, async (req, res) => {
    try {
        const { livro } = req.body;
        const bookId = req.params.id;

        await MongoDB.updateLivro(bookId, livro);

        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao atualizar livro');
    }
});

app.post('/admin/delete-book/:id', verificarAdmin, async (req, res) => {
    try {
        const bookId = req.params.id;

        await MongoDB.deleteLivro(bookId);

        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao deletar livro');
    }
});

// Iniciar Servidor na Porta 3000
app.listen(3000, () => {
    console.log('Server executando em http://localhost:3000');
});