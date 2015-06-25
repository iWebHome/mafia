#!/usr/bin/js
/**
 * This is the Main Script
 * Daemon a websocket server
 *
 * License: Apache License 2.0
 * Author: kXuan <kxuanobj@gmail.com>
 *
 * Submit your issue to https://github.com/Kxuan/mafia/issues
 */

var WebSocketServer = require('websocket').server;
var http = require('http');
var fs = require('fs');
var readline = require('readline');
var mafia = require('mafia.js');
var RoomManager = require('mafia-room.js');

s = (function () {
    "use strict";
    var rl, wsServer, httpServer;

    rl = readline.createInterface(process.stdin, process.stdout);
    rl.setPrompt('>');

    httpServer = http.createServer(function (request, response) {
        var realPath = request.url;
        var mime;
        if (realPath == '/')
            realPath = '/index.html';
        var match = realPath.match(/\.(js|css|html)$/);
        if (!match) {
            response.writeHead(404);
            response.end();
            return;
        }
        switch (match[1]) {
            case 'js':
                mime = 'text/javascript';
                break;
            case 'html':
                mime = 'text/html';
                break;
            case 'css':
                mime = 'text/css';
                break;
            default :
                response.writeHead(404);
                response.end();
                return;
        }
        realPath = process.cwd() + realPath;
        fs.exists(realPath, function (exists) {
            if (!exists) {
                response.writeHead(404, {
                    'Content-Type': 'text/plain'
                });
                response.end();
            } else {
                fs.readFile(realPath, "binary", function (err, file) {
                    if (err) {
                        response.writeHead(500, {
                            'Content-Type': 'text/plain'
                        });
                        response.end(err);
                    } else {
                        response.writeHead(200, {
                            'Content-Type': mime
                        });
                        response.write(file, "binary");
                        response.end();
                    }
                });
            }
        });
    });

    wsServer = new WebSocketServer({
        httpServer: httpServer,
        autoAcceptConnections: false
    });

    wsServer.on('request', function (request) {
        if (!originIsAllowed(request.origin)) {
            // Make sure we only accept requests from an allowed origin
            request.reject();
            return;
        }

        var connection = request.accept('mafia', request.origin);
        connection.user = mafia.bind(connection);

        connection.on('message', function (message) {
            if (message.type === 'utf8') {
                var obj;
                try {
                    obj = JSON.parse(message.utf8Data);
                } catch (ex) {
                    connection.close();
                    return;
                }
                if (obj.command === undefined) {
                    connection.close();
                    return;
                }
                obj = mafia.perform(connection.user, obj);
                if (obj !== undefined) {
                    connection.sendUTF(JSON.stringify(obj));
                }
            }
            else if (message.type === 'binary') {
                console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
                connection.sendBytes(message.binaryData.length);
            }
        });
        connection.on('close', function (reasonCode, description) {
            mafia.leave(connection.user, reasonCode, description);
        });
    });

    httpServer.listen(1561, function () {
        console.log((new Date()) + ' Server is listening on port 1561');
    });
    function originIsAllowed(origin) {
        return true;
        //return !!origin.match(/g\.ixuan\.org/);
    }


    rl.on('line', function (line) {
        switch (line) {
            case 'd':
                RoomManager.add();
                console.log('Debug Room ID:' + RoomManager.debugRoom);
                break;
        }
        rl.prompt();
    });
    return {
        r: function () {
            RoomManager.add();
            console.log('Debug Room ID:' + RoomManager.debugRoom);
            wsServer.connections.forEach(function (conn) {
                conn.sendUTF(JSON.stringify({type: 'reload-force'}));
            })
        }
    };
})();