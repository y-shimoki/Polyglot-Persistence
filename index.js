import express from 'express';

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Base de dados simulada para testes do front-end
let livros = [
    { 
        id: 1, 
        titulo: 'Harry Potter e a Pedra Filosofal', 
        autor: 'J.K. Rowling', 
        generos: 'Fantasia', 
        preco: '49.90', 
        sinopse: 'Um jovem bruxo descobre um mundo mágico em Hogwarts.', 
        capa: '/imagens/harrypotter.jpg' 
    },
    { 
        id: 2, 
        titulo: 'Jogos Vorazes', 
        autor: 'Suzanne Collins', 
        generos: 'Distopia', 
        preco: '39.90', 
        sinopse: 'Sobrevivência num reality show mortal.', 
        capa: '/imagens/jogosvorazes.jpg' 
    },
    { 
        id: 3, 
        titulo: 'O Senhor dos Anéis: A Sociedade do Anel', 
        autor: 'J.R.R. Tolkien', 
        generos: 'Fantasia / Aventura', 
        preco: '69.90', 
        sinopse: 'A jornada épica para destruir o anel mágico.', 
        capa: '/imagens/senhordosaneis.jpg' 
    },
    { 
        id: 4, 
        titulo: '1984', 
        autor: 'George Orwell', 
        generos: 'Ficção Científica / Clássico', 
        preco: '34.90', 
        sinopse: 'Sociedade totalitária sob vigilância constante.', 
        capa: '/imagens/1984.jpg' 
    },
    { 
        id: 5, 
        titulo: 'Dom Casmurro', 
        autor: 'Machado de Assis', 
        generos: 'Literatura Brasileira', 
        preco: '29.90', 
        sinopse: 'A clássica dúvida sobre a traição de Capitu.', 
        capa: '/imagens/domcasmurro.jpg' 
    },
    { 
        id: 6, 
        titulo: 'O Pequeno Príncipe', 
        autor: 'Antoine de Saint-Exupéry', 
        generos: 'Infantil', 
        preco: '24.90', 
        sinopse: 'As reflexões de um pequeno príncipe pelos planetas.', 
        capa: '/imagens/pequenoprincipe.jpg' 
    },
    { 
        id: 7, 
        titulo: 'O Hobbit', 
        autor: 'J.R.R. Tolkien', 
        generos: 'Fantasia', 
        preco: '45.90', 
        sinopse: 'As aventuras de Bilbo Bolseiro rumo à Montanha Solitária.', 
        capa: '/imagens/hobbit.jpg' 
    },
    { 
        id: 8, 
        titulo: 'Fahrenheit 451', 
        autor: 'Ray Bradbury', 
        generos: 'Distopia / Ficção Científica', 
        preco: '37.90', 
        sinopse: 'Um mundo onde os livros são proibidos e queimados.', 
        capa: '/imagens/fahrenheit.jpg' 
    },
    { 
        id: 9, 
        titulo: 'Memórias Póstumas de Brás Cubas', 
        autor: 'Machado de Assis', 
        generos: 'Literatura Brasileira', 
        preco: '32.90', 
        sinopse: 'A narrativa irônica de um defunto autor.', 
        capa: '/imagens/brascubas.jpg' 
    },
    { 
        id: 10, 
        titulo: 'Percy Jackson e o Ladrão de Raios', 
        autor: 'Rick Riordan', 
        generos: 'Fantasia / Infantil', 
        preco: '42.90', 
        sinopse: 'Um jovem descobre que é filho de Poseidon.', 
        capa: '/imagens/percyjackson.jpg' 
    },
    { 
        id: 11, 
        titulo: 'Duna', 
        autor: 'Frank Herbert', 
        generos: 'Ficção Científica', 
        preco: '59.90', 
        sinopse: 'Disputa política e religiosa pelo planeta árido Arrakis.', 
        capa: '/imagens/duna.jpg' 
    },
    { 
        id: 12, 
        titulo: 'O Alquimista', 
        autor: 'Paulo Coelho', 
        generos: 'Literatura Brasileira', 
        preco: '39.90', 
        sinopse: 'A jornada de um pastor andaluz em busca de tesouro.', 
        capa: '/imagens/alquimista.jpg' 
    }
];

let usuario = {
    nome: 'Erik',
    saldo: 150.00,
    livrosComprados: [],
    reviews: []
};

let reviews = [];

// ================= ROTAS GET (PÁGINAS) =================

// Página 1: Login / Cadastro
app.get('/', (req, res) => {
    res.render('login');
});

// Página 2: Home (Catálogo)
app.get('/home', (req, res) => {
    const isAdmin = usuario.nome.toLowerCase() === 'admin';

    res.render('home', { 
        livros, // Envia a lista completa de livros
        usuario, 
        isAdmin 
    });
});
// Página 3: Perfil do Usuário / Admin
app.get('/user', (req, res) => {
    const isAdmin = usuario.nome.toLowerCase() === 'admin';
    res.render('user', { usuario, isAdmin, reviews });
});

// Página 4: Detalhes do Livro
app.get('/book/:name', (req, res) => {
    const bookName = req.params.name;
    
    // Busca o livro pelo título
    const livroEncontrado = livros.find(l => l.titulo.toLowerCase() === bookName.toLowerCase()) || {
        id: 99,
        titulo: bookName,
        autor: 'Autor Exemplo',
        generos: 'Aventura',
        preco: '49.90',
        sinopse: 'Esta é a sinopse detalhada do livro selecionado.'
    };
    
    // Filtra as reviews deste livro
    const reviewsDoLivro = reviews.filter(r => r.livro.toLowerCase() === bookName.toLowerCase());

    res.render('book', { livro: livroEncontrado, reviews: reviewsDoLivro });
  
});
// Ação: Terminar Sessão (Logout)
app.get('/logout', (req, res) => {
    // Redefine ou limpa os dados do utilizador atual se necessário
    usuario.nome = '';
    res.redirect('/');
});


// ================= ROTAS POST (AÇÕES) =================

// Ação: Entrar (Login)
app.post('/login', (req, res) => {
    const { nome } = req.body;
    if (nome) usuario.nome = nome;
    res.redirect('/home');
});

// Ação: Criar Conta (Register)
app.post('/register', (req, res) => {
    const { nome } = req.body;
    if (nome) usuario.nome = nome;
    res.redirect('/home');
});

// Ação: Comprar Livro
app.post('/buy/:name', (req, res) => {
    const bookName = req.params.name;
    if (!usuario.livrosComprados.includes(bookName)) {
        usuario.livrosComprados.push(bookName);
    }
    res.redirect('/user'); // Redireciona para o perfil para ver o livro comprado
});

// Ação: Enviar Review
app.post('/review/:name', (req, res) => {
    const bookName = req.params.name;
    const { nota, texto } = req.body;

    const novaReview = {
        usuario: usuario.nome,
        livro: bookName,
        nota: nota || 5,
        texto: texto || ''
    };

    reviews.push(novaReview);
    usuario.reviews.push(novaReview);

    res.redirect(`/book/${encodeURIComponent(bookName)}`);
});

// Ação Admin: Adicionar Novo Livro
app.post('/admin/add-book', (req, res) => {
    const { titulo, sinopse, generos, autor, preco } = req.body;
    livros.push({
        id: Date.now(),
        titulo,
        sinopse,
        generos,
        autor,
        preco
    });
    res.redirect('/home');
});

// Iniciar Servidor na Porta 3000
app.listen(3000, () => {
    console.log('Server executando em http://localhost:3000');
});