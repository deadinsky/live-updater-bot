var Discord = require('discord.io');
var WebSocket = require('ws');
var request = require("request")
var url = "https://www.reddit.com/live/11ecntc3z480f/about.json"
var socket = "";
var socketURL = "";
var mysql = require('mysql');
var con;
mysql_connect();
var lastDiscordID = "";
var lastRedditID = "";
var channelNum = "<redacted>";
var ownerNum = "<redacted>";
var botNum = "<redacted>";
var trimNum = 500;
var tableName = "theta_emerald";
var realEnd = 0;
newSocket();

var bot = new Discord.Client({
    token: "<redacted>",
    autorun: true
});

bot.on('ready', function() {
    //console.log('Logged in as %s - %s\n', bot.username, bot.id);
    bot.sendMessage({
      to: channelNum,
      message: "Connected."
    });
});

bot.on('message', function(user, userID, channelID, message, event) {
  if (channelID == channelNum) {
    if (userID == ownerNum) {
      if (message == "!stop") {
        realEnd = 1;
        socket.close();
        con.end();
        lastRedditID = "";
        bot.sendMessage({
          to: channelNum,
          message: "Disconnected."
        });
      } else if (message == "!reset") {
          var delet = "DELETE FROM "+tableName+";";
          con.query(delet, function (err, result) {
            if (err) throw err;
            var output = "Deleted rows: "+result.affectedRows+"; Remaining rows: 0;"
            bot.sendMessage({
              to: channelNum,
              message: output
            });
          });
        lastDiscordID = ""; lastRedditID = "";
      } else if (message == "!trim") {
          var delet = "DELETE FROM "+tableName+" WHERE ID IN (SELECT ID FROM (SELECT ID FROM "+tableName+" ORDER BY ID LIMIT "+(trimNum-1)+",10000) a);";
          con.query(delet, function (err, result) {
            if (err) throw err;
            var output = "Deleted rows: "+result.affectedRows+"; Remaining rows: "+trumNum+" or less;"
            bot.sendMessage({
              to: channelNum,
              message: output
            });
          });
      } else if (message == "!fetch") {
        newSocket();
      }
    } else if (userID == botNum && (message != "Connected." && message != "Disconnected.")) {
      if (lastRedditID) {
        lastDiscordID = event.d.id;
        var insert = 'INSERT INTO '+tableName+' (discord, reddit) VALUES ("'+lastDiscordID+'", "'+lastRedditID+'");';
        con.query(insert, function (err, result) {
          if (err) throw err;
          //console.log("Result: " + result);
        });
      }
    }
  }
});

bot.on('disconnect', function(errMsg, code) {
  console.log("Bot has disconnected");
  console.log(errMsg);
  console.log(code);
  bot.connect();
  console.log("Reconnected");
});

socketOnError = function(error) {
  console.log('WebSocket Error: ' + error);
};

socketOnMessage = function(event) {
  var message = JSON.parse(event.data);
  if (message.type == "update" && message.payload.data.author != "UpdaterNeeded"){
    var output = message.payload.data.body + " - /u/"+message.payload.data.author;
    lastRedditID = message.payload.data.name;
    //console.log(output);
    bot.sendMessage({
      to: channelNum,
      message: output
    });
  } else if (message.type == "strike") {
    var victim = message.payload;
      var strike = 'SELECT discord FROM '+tableName+' WHERE reddit = "'+victim+'";';
      con.query(strike, function (err, result, fields) {
        if (err) throw err;
        //var res = JSON.parse(result);
        if (result && result[0]) {
          var newID = result[0].discord;
          bot.getMessage({
            channelID: channelNum,
            messageID: newID
          }, function(err, res) {
            var oldMessage = res.content;
            var newMessage = "~~" + oldMessage + "~~";
            bot.editMessage({
              channelID: channelNum,
              messageID: newID,
              message: newMessage
            });
          });
        }
      });
  } else if (message.type == "delete") {
    var victim = message.payload;
      var delet = 'SELECT discord FROM '+tableName+' WHERE reddit = "'+victim+'";';
      con.query(delet, function (err, result, fields) {
        if (err) throw err;
        if (result && result[0]) {
          var newID = result[0].discord;
          bot.deleteMessage({
            channelID: channelNum,
            messageID: newID
          });
        }
      });
  }
};

socketOnOpen = function(event) {
  console.log("socket open");
};


socketOnClose = function(event) {
  console.log("socket close");
  if (realEnd == 0) {
    newSocket();
  } else {
    console.log("real end");
  }
};

function mysql_connect() {
  con = mysql.createConnection({
    host: "localhost",
    user: "liveupdater",
    password: "<redacted>",
    database: "liveupdater",
  });
  con.connect(function(err) {
    if (err) throw err
  });
  con.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      mysql_handleDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
  return;
}

function newSocket() {
  request({
    url: url,
    json: true
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      socketURL = body.data.websocket_url;
      console.log(socketURL) // Print the json response
      socket = new WebSocket(socketURL);
      socket.onerror = socketOnError;
      socket.onmessage = socketOnMessage;
      socket.onopen = socketOnOpen;
      socket.onclose = socketOnClose;
    }
  });
}

function mysql_handleDisconnect() {
  mysql_connect();
}
