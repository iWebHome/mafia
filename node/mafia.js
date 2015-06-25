/**
 * Receive players command, send it to room
 *
 * License: Apache License 2.0
 * Author: kXuan <kxuanobj@gmail.com>
 *
 * Submit your issue to https://github.com/Kxuan/mafia/issues
 */

(function () {
    "use strict";

    var uniqueId = 1;
    var roomManager = require('mafia-room.js');

    function MafiaUser(conn) {
        this.conn = conn;
        /** @param {MafiaRoom} */
        this.room = null;
        this.id = ++uniqueId;
        this.isReady = false;
        this.nick = null;
        this.role = null;
        this.isAlive = true;
        this.voteTo = null;
        this.voteCount = 0;

        this.send = function (msg) {
            this.conn.sendUTF(JSON.stringify(msg));
        };

        this.commands = {
            'createRoom': function (request) {
                if (typeof request.nick == 'string' && request.nick.length > 0) {
                    this.nick = request.nick;
                }
                if (this.nick) {
                    this.room = roomManager.add(this);
                    return {type: 'createRoom', roomId: this.room.index};
                } else {
                    return {type: 'error', error: '需要昵称'};
                }
            },
            'joinRoom': function (request) {
                if (this.room) {
                    return {type: 'error', error: '已在房间中了'};
                }
                if (typeof request.nick == 'string' && request.nick.length > 0) {
                    this.nick = request.nick;
                }
                if (!this.nick)
                    return {type: 'error', error: '需要昵称'};

                var room = roomManager.get(request.roomId);
                if (room === undefined)
                    return {type: 'error', error: '房间不存在'};
                if (room.players.length >= 20)
                    return {type: 'error', error: '房间已满'};
                if (room.status == 'G')
                    return {type: 'error', error: '房间已开始游戏'};

                this.room = room;
                room.addPlayer(this);

                var msgPlayers = [];
                room.players.forEach(function (p) {
                    msgPlayers.push({
                        id: p.id,
                        nick: p.nick,
                        ready: p.isReady
                    });
                });
                return {type: 'joinRoom', roomId: room.index, players: msgPlayers};

            },
            'ready': function (request) {
                if (request.room === null) {
                    return {type: 'error', error: '玩家并没有在房间内'};
                }
                if (request.isReady == this.isReady)
                    return;
                this.isReady = request.isReady;
                this.room.broadcast({type: 'playerReady', playerId: this.id, isReady: this.isReady}, this);
                return {type: 'ready', isReady: this.isReady};
            },
            'start': function (request) {
                if (!this.room)
                    return {type: 'error', error: '不在房间里'};
                if (!this.room.isManager(this)) {
                    return {type: 'error', error: '非房主不能开始游戏'};
                }

                this.room.players.forEach(function (p) {
                    if (!p.isReady)
                        return {type: 'error', error: '有玩家未准备好'};
                });
                this.room.start();
            },
            'pass': function (request) {
                if (!this.room)
                    return {type: 'error', error: '不在房间里'};
                if (!this.room.passPlayer(this))
                    return {type: 'error', error: '无效操作'};
            },
            //公投 - 平民投票
            'vote': function (request) {
                if (!this.room)
                    return {type: 'error', error: '不在房间里'};
                if (!this.isAlive)
                    return {type: 'error', error: '你已经挂了'};

                var to = request.to;
                if (to == this.voteTo)
                    return;
                if (to === undefined) {
                    this.room.broadcast({type: 'vote', playerId: this.id});
                } else {
                    for (var i = 0; i < this.room.votePlayers.length; i++) {
                        if (this.room.votePlayers[i].id == to) {
                            this.voteTo = to;
                            this.room.broadcast({type: 'vote', playerId: this.id, to: this.voteTo});
                            return;
                        }
                    }
                }
                return {type: 'error', error: '该玩家不能够被投票'};
            },
            //警察查验身份
            'check': function (request) {
                if (!this.room)
                    return {type: 'error', error: '不在房间里'};
                if (!this.isAlive)
                    return {type: 'error', error: '你已经挂了'};
                if (this.room.status != 'N')
                    return {type: 'error', error: '现在还不是晚上'};
                if (this.role != 'P')
                    return {type: 'error', error: '不是警察不能查验身份'};
                if (this.isReady)
                    return {type: 'error', error: '已经确认就不能再改了'};
                var to = request.to;

                if (to == this.voteTo) {
                    this.voteTo = null;
                    this.room.broadcast({type: 'check', playerId: this.id}, this.room.npcList.P);
                } else {
                    var player = this.room.getPlayer(to);
                    if (player === null) {
                        return {type: 'error', error: '目标玩家不在房间内'};
                    }
                    if (player.role === 'P')
                        return {type: 'error', error: '他是警察，这不需要再检查'};
                    this.voteTo = to;
                    this.room.broadcast({type: 'check', playerId: this.id, to: this.voteTo}, this.room.npcList.P);
                }
            },
            //杀手杀人
            'kill': function (request) {
                if (!this.room)
                    return {type: 'error', error: '不在房间里'};
                if (!this.isAlive)
                    return {type: 'error', error: '你已经挂了'};
                if (this.room.status != 'N')
                    return {type: 'error', error: '现在还不是晚上'};
                if (this.role != 'K')
                    return {type: 'error', error: '不是杀手没有枪'};
                if (this.isReady)
                    return {type: 'error', error: '已经确认就不能再改了'};

                var to = request.to;
                if (to == this.voteTo) {
                    this.voteTo = null;
                    this.room.broadcast({type: 'kill', playerId: this.id}, this.room.npcList.K);

                } else {
                    var player = this.room.getPlayer(to);
                    if (player === null) {
                        return {type: 'error', error: '目标玩家不在房间内'};
                    }
                    if (player.role === 'K')
                        return {type: 'error', error: '显然他是你的同伙'};
                    this.voteTo = to;
                    this.room.broadcast({type: 'kill', playerId: this.id, to: this.voteTo}, this.room.npcList.K);
                }
            }
        };
        this.leave = function (code, reason) {
            if (this.room) {
                this.room.playerQuit(this);
                this.room = null;
            }
        }
    }

    module.exports = new function () {
        this.bind = function (conn) {
            var user = new MafiaUser(conn);
            user.send({userId: user.id});
            return user;
        };

        /**
         *
         * @param {MafiaUser} user
         * @param code
         * @param reason
         */
        this.leave = function (user, code, reason) {
            user.leave(code, reason)
        };

        /**
         *
         * @param {MafiaUser} user
         * @param request
         */
        this.perform = function (user, request) {
            var proc = user.commands[request.command];
            if (proc !== undefined)
                return proc.call(user, request);
            else
                return {error: "Command is not support."};
        };
    };

})();