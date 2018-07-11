const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 8080;

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

let urlDatabase = {
  'b2xVn2': 'http://www.lighthouselabs.ca',
  '9sm5xK': 'http://www.google.com'
};

function generateRandomString() {
  const alphanumericChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
  let randomString = '';

  for (let i = 0; i < 6; i++) {
    let random = Math.floor(Math.random() * 63);
    randomString += alphanumericChars[random];
  }

  return randomString;
}

app.get('/', (req, res) => {
  res.end('Hello!');
});

// Set username cookie and redirect to `/urls`
app.post('/login', (req, res) => {
  const userCookie = req.body.username;

  res.cookie('username', userCookie);
  res.redirect('/urls');
});

// Clears username cookie
app.post('/logout', (req, res) => {
  res.clearCookie('username');
  res.redirect('/urls');
});

app.get('/urls', (req, res) => {
  let templateVars = {
    urls: urlDatabase,
    username: req.cookies['username']
  };

  res.render('urls_index', templateVars);
});

app.get('/urls/new', (req, res) => {
  res.render('urls_new', { username: req.cookies['username'] });
});

// Delete shortURL key-value pair from database; redirect to urls page
app.post('/urls/:key/delete', (req, res) => {
  const deleteURL = req.params.key;

  delete urlDatabase[deleteURL];

  res.redirect('/urls');
});

// Add shortURL: longURL key:value pair to urlDatabase and redirect
// to another page (Browser sends another GET request).
app.post('/urls', (req, res) => {
  let shortURL = generateRandomString();
  urlDatabase[shortURL] = req.body.longURL;

  res.redirect(`/urls/${shortURL}`);
});

app.get('/urls/:key', (req, res) => {
  // If key is not in urlDatabase object, respond with `404: Not Found`.
  if (!(req.params.key in urlDatabase)) {
    res.status(404).send('Resource Not Found');
  } else {

    let templateVars = {
      urls: urlDatabase,
      shortURL: req.params.key,
      username: req.cookies['username']
    };

    res.render('urls_show', templateVars);
  }
});

// Update shortURL to link to a different longURL
app.post('/urls/:key/update', (req, res) => {
  const shortURL = req.params.key;
  const updatedURL = req.body.updatedURL;

  urlDatabase[shortURL] = updatedURL;

  res.redirect(`/urls/${shortURL}`);
});

app.get('/u/:key', (req, res) => {
  let longURL = urlDatabase[req.params.key];

  res.redirect(longURL);
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});