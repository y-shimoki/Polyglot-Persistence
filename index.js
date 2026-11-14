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
        const isAdmin = usuario.user.toLowerCase() === 'admin';

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
        if (!usuario || usuario.user.toLowerCase() !== 'admin') {
            return res.status(403).send('Acesso negado.');
        }

        const livros = await MongoDB.getLivros();
        res.render('admin', { livros, usuario });
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

        if (usuarioExistente) {
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

// Ação Admin: Adicionar Novo Livro
app.post('/admin/add-book', async (req, res) => {
    try {
        const usuario = req.session.usuario;
        if (!usuario || usuario.user.toLowerCase() !== 'admin') {
            return res.status(403).send('Acesso negado.');
        }

        const { titulo, sinopse, genero, autor } = req.body;

        await MongoDB.adicionarLivro({
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

// Ação Admin: Atualizar Livro (CRUD - Update)
app.post('/admin/update-book/:id', async (req, res) => {
    try {
        const usuario = req.session.usuario;
        if (!usuario || usuario.user.toLowerCase() !== 'admin') {
            return res.status(403).send('Acesso negado.');
        }

        const bookId = req.params.id;
        const { titulo, sinopse, genero, autor } = req.body;

        await MongoDB.atualizarLivro(bookId, {
            titulo,
            sinopse,
            genero,
            autor
        });

        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao atualizar livro');
    }
});

// Ação Admin: Deletar Livro (CRUD - Delete)
app.post('/admin/delete-book/:id', async (req, res) => {
    try {
        const usuario = req.session.usuario;
        if (!usuario || usuario.user.toLowerCase() !== 'admin') {
            return res.status(403).send('Acesso negado.');
        }

        const bookId = req.params.id;
        await MongoDB.deletarLivro(bookId);

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