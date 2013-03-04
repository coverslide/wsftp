var fs = require('fs')
var statDir = require('stat-all-the-things')
var WebSocketServer = require('ws').Server
var path = require('path')

require('mkee')(WSFTP)

module.exports = WSFTP

function WSFTP(connection, root){
  var _this = Object.create(WSFTP.prototype)
  var wss = _this.server = new WebSocketServer(connection)

  wss.on('connection', onConnection)

  return _this

  function onConnection(socket){
    var requestRead = false
    var request
    var pathname

    socket.on('error', onError)
    socket.on('message', onMessage)

    function onError(err){
      _this.emit('socket-error', socket, err)
    }

    function onMessage(message){
      if(!requestRead){
        requestRead = true // all subsequent messages are ignored
        try{
          request = JSON.parse(message)
        } catch(err){
          return sendError(err.message)
        }
        if(!request.url){
          return sendError("URL parameter not found")
        }
        pathname = path.join(root, path.normalize('/' + request.url))
        fs.stat(pathname, function(err, stat){
          if(err) return sendError(err.message)
          stat.directory = stat.isDirectory()
          send({stat: stat})
          if(stat.isDirectory()){
            statDir(pathname, function(err, stats){
              if(err) return sendError(err.message)
              send({directoryStats:stats}, function(){
                socket.close(1000)
              })
            })
          } else if(stat.isFile()){
            var stream = fs.createReadStream(pathname, request.options)
            stream.bufferSize /= 10
            stream.on('data', function(d){
              socket.send(d, {binary:true})
            })
            stream.on('end', function(){
              socket.close(1000)
            })
            stream.on('error', function(err){
              sendError(err.message)
            })
          }
        })
      }
    }

    function send(object, options, cb){
      socket.send(JSON.stringify(object), options, cb)
    }

    function sendError(message, code){
      socket.send({error: message}, function(){
        socket.close(code || 1011)
      })
    }
  }
}
