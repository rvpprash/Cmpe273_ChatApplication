/**
 * Module dependencies.
 */

var express = require('express')
  , stylus = require('stylus')
  , nib = require('nib')
  , mongoose = require('mongoose')
  , users = {}
  , crypto = require('crypto')
  , key = 'abcd1234'
  , algorithm = 'sha1'
  , sio = require('socket.io');

/**
 * App.
 */

var app = express.createServer();
var hash, hmac;
var user;

/**
 * App configuration.
 */

app.configure(function () {
  app.use(stylus.middleware({ src: __dirname + '/public', compile: compile }));
  app.use(express.static(__dirname + '/public'));
  app.set('views', __dirname);
  app.set('view engine', 'jade');

  function compile (str, path) {
    return stylus(str)
      .set('filename', path)
      .use(nib());
  };
});

/**
 * App routes.
 */

app.get('/', function (req, res) {
   res.render('index', { layout: false });
});

/**
 * App listen.
 */

app.listen(process.env.port, function () {
  var addr = app.address();
  console.log('   app listening on http://' + addr.address + ':' + addr.port);
});

/**
 * Establishing Connection to MongoDB
 */
mongoose.connect('mongodb://localhost/chat',function(err){
	if(err){
		console.log(err);
	}
	else{
		console.log('connectedto mongodb!');
	}
});

var chatschema = mongoose.Schema({
	nick: String,
	msg: String,
	date: {type: Date, default: Date.now}
});

var chat = mongoose.model('ChatMessage', chatschema);

var userschema = mongoose.Schema({
	user: String,
	password: String,
	date: {type: Date, default: Date.now}
});

var user = mongoose.model('Userinfo',userschema);

/**
 * Socket.IO server (single process only)
 */

var io = sio.listen(app)
  , nicknames = {};


io.sockets.on('connection', function (socket) {
  socket.on('user message', function (msg) {
    hmac = crypto.createHmac(algorithm, key);
    hmac.setEncoding('hex');
    hmac.write(socket.nickname);
    hmac.end();
    var pass = hmac.read();
    var userinfo = new user({user: socket.nickname, password: pass});
    userinfo.save(function(err){
    	 if(err) throw err;
    	 socket.broadcast.emit('error in user info', socket.nickname, msg);
    });    
    var newMsg = new chat({msg: msg, nick: socket.nickname});
    newMsg.save(function(err){
    	 if(err) throw err;
    	 socket.broadcast.emit('user message', socket.nickname, msg);
    });
  });

  socket.on('nickname', function (nick, fn) {
    if (nicknames[nick]) {
      fn(true);
    } else {
      fn(false);
      nicknames[nick] = socket.nickname = nick;
      socket.broadcast.emit('announcement', nick + ' connected');
      io.sockets.emit('nicknames', nicknames);
    }
  });

  socket.on('disconnect', function () {
    if (!socket.nickname) return;

    delete nicknames[socket.nickname];
    socket.broadcast.emit('announcement', socket.nickname + ' disconnected');
    socket.broadcast.emit('nicknames', nicknames);
  });
});
