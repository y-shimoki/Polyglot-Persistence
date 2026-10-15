import express from 'express';

const app = express();
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('test', { test: 'My test variable' });
});

app.listen(3000, () => console.log('Server executando em http://localhost:3000'));