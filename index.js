import express from 'express';
import session from 'express-session';
import 'dotenv/config';
import * as MongoDB from './src/mongodb.js';
import * as Postgre from './src/postgre.js';

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'minha_chave_secreta_super_segura',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

await MongoDB.connectToMongoDB();
await Postgre.connectToPostgreSQL();

// ================= ROTAS GET (PÁGINAS) =================

// Página 1: Login / Cadastro
app.get('/', (req, res) => {
    res.render('login');
});

// Página 2: Home (Catálogo)
app.get('/home', async (req, res) => {
    try {
        const usuario = req.session.usuario;
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
        const usuario = req.session.usuario;

        if (!usuario || usuario.admin !== true) {
            return res.status(403).send('Acesso negado.');
        }

        const livros = await MongoDB.getLivros();
        res.render('admin', { books: livros, usuario }); // Certifique-se de ter uma view 'admin.ejs' se necessário
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar painel do admin.');
    }
});

// Página 3: Perfil do Usuário / Favoritos e Reviews
app.get('/user', async (req, res) => {
    try {
        const usuario = req.session.usuario;
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

        const isAdmin = usuario.user.toLowerCase() === 'admin';

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
        const usuario = req.session.usuario;
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
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
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
            req.session.usuario = { user: nome, admin: true };
            return res.redirect('/home');
        }

        const usuario = await Postgre.getUsuario(nome);
        if (!usuario || usuario.senha !== senha) {
            return res.send('Usuário ou senha incorretos.');
        }

        req.session.usuario = { user: nome, senha };
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
        const usuario = req.session.usuario;
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
        const usuario = req.session.usuario;
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
        const usuario = req.session.usuario;
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
        const usuario = req.session.usuario;

        if (!usuario) {
            return res.redirect('/login');
        }

        // Apaga todas as reviews do usuário no MongoDB
        await MongoDB.deleteReviewsByUser(usuario.user);

        // Apaga os favoritos e a conta do usuário no PostgreSQL
        await Postgre.deleteAccount(usuario.user);

        // Encerra a sessão
        req.session.destroy((err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Erro ao encerrar a sessão.');
            }

            res.redirect('/');
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao excluir a conta.');
    }
});

// Ação: Remover livro da conta
app.post('/unfavorite/:id', async (req, res) => {
    try {
        const usuario = req.session.usuario;
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
    if (req.session.usuario?.admin) {
        return next();
    }
    return res.status(403).send('Acesso permitido apenas ao administrador.');
}

// Ação Admin: Adicionar Novo Livro (Removido o campo de preço e capa conforme pedido)
app.post('/admin/add-book', async (req, res) => {
    try {
        const usuario = req.session.usuario;
        if (!usuario || usuario.user.toLowerCase() !== 'admin') {
            return res.status(403).send('Acesso negado.');
        }

        const { titulo, sinopse, genero, autor } = req.body;

        await MongoDB.addLivro({
            titulo,
            sinopse,
            genero,
            autor
        });

        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao cadastrar livro');
    }
});

// Iniciar Servidor na Porta 3000
app.listen(3000, () => {
    console.log('Server executando em http://localhost:3000');
});