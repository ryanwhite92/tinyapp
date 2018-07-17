require('dotenv').config();
const express = require('express');
const methodOverride = require('method-override');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 8080;
const urlDatabase = {};
const users = {};

// Use `EJS` Template Engine
app.set('view engine', 'ejs');

// Allows for use of PUT and DELETE
app.use(methodOverride('_method'));

// Parses incoming request bodies
app.use(bodyParser.urlencoded({extended: true}));

// Stores session data on the client within a cookie
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET, process.env.SESSION_SECRET2]
}));

// Serves static CSS files
app.use(express.static(__dirname + '/public'));

// Generates 6 character random string for userId and shortURL
function generateRandomString() {
  const alphanumericChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
  let randomString = '';

  // Randomly picks 6 characters from alphanumericChars and adds to random string
  for (let i = 0; i < 6; i++) {
    let random = Math.floor(Math.random() * 62);
    randomString += alphanumericChars[random];
  }

  return randomString;
}

// Returns an object containing urls created by a specific user
function urlsForUser(id) {
  const ownedUrls = {};

  for (let shortURL in urlDatabase) {
    if (urlDatabase[shortURL].userId === id) {
      ownedUrls[shortURL] = urlDatabase[shortURL];
    }
  }

  return ownedUrls;
}

// Returns a list of all unique visitors
function countUniqueVisits(visitors) {
  const uniqueVisitors = [];

  visitors.forEach((visitor) => {
    if (!(uniqueVisitors.includes(visitor.id))) {
      uniqueVisitors.push(visitor.id);
    }
  });

  return uniqueVisitors.length;
}

// Checks that input URL contains either `http` or `https` protocol, and adds
// `http://` if it doesn't
function verifyProtocol(link) {
  if (!link.match(/^https?:\/\//)) {
    link = `http://${link}`;
  }

  return link;
}

// Create timestamp in YYYY/MM/DD HH:MM:SS format
function createTimestamp() {
  const date = new Date();
  const year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();
  let hours = date.getHours();
  let minutes = date.getMinutes();
  let seconds = date.getSeconds();

  month = addLeadingZero(month);
  day = addLeadingZero(day);
  hours = addLeadingZero(hours);
  minutes = addLeadingZero(minutes);
  seconds = addLeadingZero(seconds);

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// Format month/day to have leading zero if single digit
function addLeadingZero(time) {
  return time <= 9 ? '0' + time : time;
}

// Check session cookie to determine if user is logged in
// Logged in: Redirects to `/urls`
// Logged out: Redirects to `/login`
app.get('/', (req, res) => {
  const userId = req.session.userId;

  // If user is registered and logged in, redirect to `/urls`
  if (userId in users) {
    res.redirect('/urls');
    return;
  }

  res.redirect('/login');
});

// Check session cookie to determine if user is logged in
// Logged in: Render template to list URLs the user has created
// Logged out: 401 error
app.get('/urls', (req, res) => {
  const userId = req.session.userId;

  // If current user is not a registered user, 403 error
  if (!(userId in users)) {
    res.status(403).send('Unauthorized');
    return;
  }

  const ownedUrls = urlsForUser(userId);
  const templateVars = {
    urls: ownedUrls,
    user: users[userId]
  };

  res.render('urls_index', templateVars);
});

// Check session cookie to determine if user is logged in
// Logged in: Render template with form to make new URL link
// Logged out: Redirects to `/login`
app.get('/urls/new', (req, res) => {
  const userId = req.session.userId;

  if (!(userId in users)) {
    res.redirect('/login');
    return;
  }

  res.render('urls_new', { user: users[userId] });
});

// Check session cookie to determine if user is logged in
// Logged in & owns URL: Render template with shortURL and URL update form
// Logged in & does not own URL: 403 error
// Logged out: 401 error
app.get('/urls/:id', (req, res) => {
  const shortURL = req.params.id;

  // If URL does not exist return 404 error
  if (!(shortURL in urlDatabase)) {
    res.status(404).send('Not Found');
    return;
  }

  const userId = req.session.userId;

  if (!(userId in users)) {
    res.status(401).send('Unauthorized');
    return;
  }

  // If userId is not the owner of the shortURL, send 403 and return.
  if (userId !== urlDatabase[shortURL].userId) {
    res.status(403).send('Forbidden');
    return;
  }

  // Get number of unique visits to the shortURL
  urlDatabase[shortURL].uniqueVisits = countUniqueVisits(urlDatabase[shortURL].visitors);

  const templateVars = {
    urlInfo: urlDatabase[shortURL],
    shortURL: shortURL,
    user: users[userId]
  };

  res.render('urls_show', templateVars);
});

// If shortURL exists redirect to URL; 404 error if shortURL does not exist
app.get('/u/:id', (req, res) => {
  const shortURL = req.params.id;
  let userId = req.session.userId;

  if (!(shortURL in urlDatabase)) {
    res.status(404).send('Not Found.');
    return;
  }

  // If user is not signed in, assign them a session cookie
  if (!(userId in users)) {
    const randomId = generateRandomString();
    req.session.userId = randomId;
    userId = req.session.userId;
  }

  // Add visitor tracking for analytics
  urlDatabase[shortURL].visitors.push({
    id: userId,
    timestamp: createTimestamp()
  });

  const longURL = urlDatabase[shortURL].url;
  res.redirect(longURL);
});

// Add shortURL:longURL key:value pair to urlDatabase and redirect
// Check session cookie to determine if user is logged in
// Logged in: Generates shortURL and associates it with the user, redirects
//            to `/urls/shortURL`
// Logged out: 401 error
app.post('/urls', (req, res) => {
  const userId = req.session.userId;

  if (!(userId in users)) {
    res.status(401).send('Unauthorized');
    return;
  }

  const shortURL = generateRandomString();
  const created = createTimestamp();
  let longURL = req.body.longURL;

  // Check that longURL includes `http` or `https` protocol, add `http` if it doesn't
  longURL = verifyProtocol(longURL);

  // Add new url pair to database and associate with current users id
  urlDatabase[shortURL] = {
    url: longURL,
    userId: userId,
    created: created.split(' ')[0],
    visitors: []
  };

  res.redirect(`/urls/${shortURL}`);
});

// Check session cookie to determine if user is logged in
// Logged in & owns URL: updates URL link and redirects to `/urls`
// Logged in & does not own URL: 403 error
// Logged out: 401 error
app.put('/urls/:id/update', (req, res) => {
  const userId = req.session.userId;
  const shortURL = req.params.id;
  let updatedURL = req.body.updatedURL;

  if (!(userId in users)) {
    res.status(401).send('Unauthorized');
    return;
  }

  if (userId !== urlDatabase[shortURL].userId) {
    res.status(403).send('Forbidden');
    return;
  }

  // Check that urdatedURL includes `http` or `https`, add `http` if it doesn't
  updatedURL = verifyProtocol(updatedURL);
  urlDatabase[shortURL].url = updatedURL;

  res.redirect(`/urls/${shortURL}`);
});

// Check session cookie to determine if user is logged in
// Logged in & owns URL: deletes URL from database and redirects to `/urls`
// Logged in & does not own URL: 403 error
// Logged out: 401 error
app.delete('/urls/:id/delete', (req, res) => {
  const userId = req.session.userId;
  const shortURL = req.params.id;

  if (!(userId in users)) {
    res.status(401).send('Unauthorized');
  }

  if (userId !== urlDatabase[shortURL].userId) {
    res.status(403).send('Forbidden');
    return;
  }

  delete urlDatabase[shortURL];

  res.redirect('/urls');
});

// Check session cookie to determine if user is logged in
// Logged in: redirects to `/urls`
// Logged out: renders template with login form
app.get('/login', (req, res) => {
  const userId = req.session.userId;

  if (userId in users) {
    res.redirect('/urls');
    return;
  }

  res.render('login', { user: users[userId] });
});

// Check session cookie to determine if user is logged in
// Logged in: redirects to `/urls`
// Logged out: renders template with register form
app.get('/register', (req, res) => {
  const userId = req.session.userId;

  if (userId in users) {
    res.redirect('/urls');
    return;
  }

  res.render('register', { user: users[userId] });
});

// Set userId cookie and redirect to `/urls`
app.post('/login', (req, res) => {
  let userId;

  // If email and/or password is empty, send 400 status code and return
  if (req.body.email === '' || req.body.password === '') {
    res.status(400).send('Bad Request');
    return;
  }

  // If email in `users` database, set userId
  for (let id in users) {
    if (users[id].email === req.body.email) {
      userId = id;
      break;
    }
  }

  // If email is not in `users` database, send 403 error
  if (!userId) {
    res.status(403).send('Forbidden');
    return;
  }

  // If submitted password doesn't match hashed password in `users`, send 403 error
  const checkPassword = bcrypt.compareSync(req.body.password, users[userId].password);
  if (!checkPassword) {
    res.status(403).send('Forbidden');
    return;
  }

  // Sets users session cookie
  req.session.userId = userId;
  res.redirect('/urls');
});

// Adds new user to database and redirects to `/urls`
app.post('/register', (req, res) => {
  // If email and/or password is empty, send 400 serror
  if (req.body.email === '' || req.body.password === '') {
    res.status(400).send('Bad Request');
    return;
  }

  // If email has already been used to register, send 400 error
  for (let id in users) {
    if (users[id].email == req.body.email) {
      res.status(403).send('Forbidden');
      return;
    }
  }

  const randomId = generateRandomString();
  const password = req.body.password;
  const hashedPassword = bcrypt.hashSync(password, 10);

  // Add new user to `users` object
  users[randomId] = {
    id: randomId,
    email: req.body.email,
    password: hashedPassword
  };

  // Sets users session cookie
  req.session.userId = randomId;
  res.redirect('/urls');
});

// Logout button clears cookie and redirects to `/login`
app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

// If page doesn't exist, send 404 error
app.get('*', (req, res) => {
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});