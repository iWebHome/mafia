/**
 * Control the game process
 *
 * License: Apache License 2.0
 * Author: kXuan <kxuanobj@gmail.com>
 *
 * Submit your issue to https://github.com/Kxuan/mafia/issues
 */
(function () {
    "use strict";
    var RoomManager;

    function MafiaRoomManager() {
        this.rooms = [];
        this.debugRoom = -1;
        this.add = function (user) {
            var room = new MafiaRoom(user);
            room.index = this.rooms.push(room) - 1;
            if (user === undefined)
                this.debugRoom = room.index;
            return room;
        };
        this.remove = function (room) {
            room.close();
            delete this.rooms[room.index];
        };
        this.get = function (roomId) {
            if (roomId == -1)
                roomId = this.debugRoom;
            return this.rooms[roomId];
        }
    }

    function MafiaRoom(master) {
        var roundTime;
        var timer;
        this.npcList = {P: [], K: [], V: []};
        this.speakerIdx = null;
        /**
         * 游戏状态
         *  P - 等待开始
         *  G - 游戏开始，等待确认同伴
         *  N - 晚上，警察查验、杀手行凶
         *  S - 遗言
         *  D - 白天，依次发言
         *  V - 公投开始
         *  OP - 警察、平民获胜
         *  OK - 杀手获胜
         * @type {string}
         */
        this.status = 'P';

        /**
         * @type {MafiaUser[]}
         */
        this.players = [];
        /**
         * @type {MafiaUser[]}
         */
        this.votePlayers = [];

        if (master)
            this.players.push(master);

        this.addPlayer = function (player) {
            this.players.push(player);
            this.broadcast({type: 'playerJoin', playerId: player.id, nick: player.nick}, player);
        };
        this.playerQuit = function (player) {
            this.players = this.players.filter(function (v) {
                return v != player;
            });
            if (this.players.length == 0) {
                RoomManager.remove(this);
            }
            if (this.status != 'P') {
                this.killPlayer(player);
            }
            this.broadcast({type: 'playerQuit', playerId: player.id}, player);
        };
        this.isManager = function (player) {
            return player == this.players[0];
        };
        this.broadcast = function (msg, select) {
            var json = JSON.stringify(msg);
            if (select instanceof Array)
                select.forEach(function (p) {
                    p.conn.sendUTF(json);
                });
            else if (select)
                this.players.forEach(function (p) {
                    if (p !== select)
                        p.conn.sendUTF(json);
                });
            else
                this.players.forEach(function (p) {
                    p.conn.sendUTF(json)
                });
        };
        this.getPlayer = function (playerId, players) {
            if (players === undefined)
                players = this.players;
            for (var i = 0; i < players.length; i++)
                if (players[i].id == playerId)
                    return players[i];
            return null;
        };
        this.getVote = function (players) {
            if (players === undefined)
                players = this.players;
            var voteId = null, sameVote = true;
            players.forEach(function (p) {
                if (!p.isAlive)
                    return;
                if (p.voteTo !== null) {
                    if (voteId === null)
                        voteId = p.voteTo;
                    else if (voteId != p.voteTo)
                        sameVote = false;
                }
            });
            return sameVote ? this.getPlayer(voteId) : null;
        };
        this.resetRole = function () {
            this.npcList = {
                P: [],
                K: [],
                V: []
            };
            var npc = 0;
            if (this.players.length >= 6)
                npc++;
            if (this.players.length >= 9)
                npc++;
            if (this.players.length >= 13)
                npc++;
            if (this.players.length >= 17)
                npc++;

            var players = this.players.slice();
            for (var i = players.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = players[i];
                players[i] = players[j];
                players[j] = temp;
            }
            var remain_npc = npc, index = 0, p;
            while (remain_npc--) {
                p = players[index++];
                p.role = 'P';
                this.npcList.P.push(p);
                p.isAlive = true;
            }
            remain_npc = npc;
            while (remain_npc--) {
                p = players[index++];
                p.role = 'K';
                this.npcList.K.push(p);
                p.isAlive = true;
            }
            while (index < players.length) {
                p = players[index++];
                p.role = 'V';
                this.npcList.V.push(p);
                p.isAlive = true;
            }
        };
        /**
         *
         * @param {MafiaUser} player
         * @returns {boolean} 游戏是否继续
         */
        this.killPlayer = function (player) {
            player.isAlive = false;
            this.broadcast({type: 'dead', playerId: player.id});
            switch (player.role) {
                case 'K':
                    if (this.npcList.K.every(function (p) {
                            return !p.isAlive
                        })) {
                        //所有杀手都挂了，游戏结束
                        this.applyStatus('OP');
                        return false;
                    }
                    break;
                case 'P':
                case 'V':
                    if (this.npcList[player.role].every(function (p) {
                            return !p.isAlive
                        })) {
                        //所有警察或平民都挂了，游戏结束
                        this.applyStatus('OK');
                        return false;
                    }
                    break;
            }
            return true;
        };
        this.passPlayer = function (player) {
            switch (this.status) {
                case 'D':
                    if (this.votePlayers[this.speakerIdx] != player)
                        return false;
                    this.nextSpeaker();
                    break;
                case 'S':
                    if (this.votePlayers.length == 1 && this.votePlayers[0] == player) {
                        this.nextStatus();
                    }
                    break;
                case 'N':
                    if (!player.voteTo)
                        return;
                    player.isReady = true;
                    this.broadcast({type: 'pass', playerId: player.id, to: player.voteTo}, this.npcList[player.role]);
                    if (this.npcList.P.every(function (p) {
                            return p.isReady;
                        })
                        && this.npcList.K.every(function (p) {
                            return p.isReady;
                        })) {
                        this.nextStatus();
                    }
                    break;
                case 'V':
                    if (!player.voteTo)
                        return;
                    player.isReady = true;
                    this.broadcast({type: 'pass', playerId: player.id, to: player.voteTo});
                    break;
            }
            return true;
        };
        this.nextSpeaker = function () {
            if (this.status != 'D')
                return;
            var msg = {type: 'nextSpeaker', roundTime: roundTime};
            var prevSpeaker = this.votePlayers[this.speakerIdx];
            if (prevSpeaker) {
                msg.prev = prevSpeaker.id;
                this.clearTimer();
            }
            ++this.speakerIdx;
            if (this.speakerIdx < this.votePlayers.length) {
                var speaker = this.votePlayers[this.speakerIdx];
                msg.speaker = speaker.id;
                //console.log("发言:" + speaker.nick);
                this.broadcast(msg);
                timer = setTimeout(this.nextSpeaker.bind(this), roundTime * 1000);
            } else {
                //所有人都发言结束
                this.nextStatus();
            }
        };

        this.applyStatus = function (status) {
            this.status = status;
            //console.log("切换状态:" + this.status);

            switch (status) {
                case 'G':
                    //游戏开始5秒后进入晚上
                    timer = setTimeout(this.nextStatus, 5 * 1000);
                    this.resetRole();
                    var npc = {
                        P: [], K: [], V: []
                    };
                    this.npcList.V.forEach(function (p) {
                        p.send({
                            type: 'gameStart',
                            role: 'V',
                            roundTime: 5
                        })
                    });
                    this.npcList.P.forEach(function (p) {
                        npc.P.push(p.id);

                        p.send({
                            type: 'gameStart',
                            role: 'P',
                            roundTime: 5,
                            buddy: npc.P
                        });
                    });
                    this.npcList.K.forEach(function (p) {
                        npc.K.push(p.id);

                        p.send({
                            type: 'gameStart',
                            role: 'K',
                            roundTime: 5,
                            buddy: npc.K
                        });
                    });
                    break;
                case 'N':
                    //晚上开始roundTime后进入白天
                    this.players.forEach(function (p) {
                        p.isReady = false;
                    });
                    this.broadcast({
                        type: 'gameStatus',
                        status: this.status,
                        roundTime: roundTime
                    });

                    timer = setTimeout(this.nextStatus, roundTime * 1000);
                    break;
                case 'D':
                    //白天开始,按照顺序发言
                    this.broadcast({
                        type: 'gameStatus',
                        status: this.status,
                        roundTime: roundTime
                    });

                    this.speakerIdx = -1;
                    this.nextSpeaker();
                    break;
                case 'V':
                    //白天投票开始，1/2 roundTime后统计票数
                    var votes = [];
                    this.votePlayers.forEach(function (p) {
                        votes.push(p.id);
                    });
                    this.broadcast({
                        type: 'gameStatus',
                        status: this.status,
                        roundTime: roundTime / 2,
                        votes: votes
                    });
                    timer = setTimeout(this.nextStatus, roundTime / 2 * 1000);
                    break;
                case 'S':
                    this.broadcast({
                        type: 'gameStatus',
                        status: this.status,
                        roundTime: roundTime / 2,
                        playerId: this.votePlayers[0].id
                    });
                    timer = setTimeout(this.nextStatus, roundTime / 2 * 1000);
                    break;
                case 'OP':
                case 'OK':
                    var players = [];
                    this.players.forEach(function (p) {
                        players.push({id: p.id, role: p.role, isAlive: p.isAlive});
                    });
                    this.broadcast({
                        type: 'gameOver',
                        status: this.status,
                        players: players
                    });
                    this.clearTimer();
                    break;
            }
        };
        this.nextStatus = function () {
            //console.log("当前状态:" + this.status);
            this.clearTimer();
            switch (this.status) {
                case 'D':
                    //白天结束，进入白天投票环节
                    this.applyStatus('V');
                    break;
                case 'G':
                    //游戏开始，进入晚上
                    this.applyStatus('N');
                    break;
                case 'V':
                    //白天投票结束，进入晚上
                    var highVote = 0;
                    this.players.forEach(function (p) {
                        if (!p.isAlive)
                            return;
                        if (p.voteTo !== null) {
                            var player = this.getPlayer(p.voteTo, this.votePlayers);
                            if (player) {
                                ++player.voteCount;
                                if (player.voteCount > highVote)
                                    highVote = player.voteCount;
                            }
                        }
                    }.bind(this));
                    this.votePlayers = this.votePlayers.filter(function (p) {
                        return p.voteCount == highVote;
                    });
                    if (this.votePlayers.length > 1) {
                        //继续公投
                        this.applyStatus('D');
                    } else {
                        if (this.killPlayer(this.votePlayers[0])) {
                            this.applyStatus('N');
                        }
                    }
                    break;
                case 'N':
                    //晚上投票结束
                    //统计警察票
                    var pvote = this.getVote(this.npcList.P);
                    if (pvote !== null) {
                        this.broadcast({type: 'role', playerId: pvote.id, role: pvote.role}, this.npcList.P);
                    }
                    //统计杀手票
                    var kvote = this.getVote(this.npcList.K);
                    if (kvote) {
                        if (!this.killPlayer(kvote))
                            return;
                        this.votePlayers = [kvote];
                        this.applyStatus('S');
                        break;
                    }
                //No one has been killed, so we skip status 'S'
                //fall through
                case 'S':
                    //所有活人进入被公投组
                    this.votePlayers = [];
                    this.players.forEach(function (p) {
                            if (p.isAlive)
                                this.votePlayers.push(p);
                        }.bind(this)
                    );
                    //进入白天
                    this.applyStatus('D');
                    break;
            }

            //任何状态更变都导致投票状态重置
            this.players.forEach(function (p) {
                p.voteTo = null;
                p.voteCount = 0;
            });
        }.bind(this);
        this.clearTimer = function () {
            if (timer) {
                clearTimeout(timer);
                timer = 0;
                return true;
            }
            return false;
        };
        this.start = function () {
            roundTime = 60;
            this.applyStatus('G');

        };
        this.close = function () {
            //TODO kick all player
            this.clearTimer();
        };

    }

    if (RoomManager === undefined)
        RoomManager = new MafiaRoomManager();
    module.exports = RoomManager;
})
();