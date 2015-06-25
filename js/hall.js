/**
 * License: Apache License 2.0
 * Author: kXuan <kxuanobj@gmail.com>
 *
 * Submit your issue to https://github.com/Kxuan/mafia/issues
 */

(function () {
    "use strict";

    var mainWnd = createMainWindow(),
        newRoomWnd = createNewRoomWindow(),
        joinRoomWnd = createJoinRoomWindow(),
        socket,
        roomNo = NaN;

    function createMainWindow() {
        var wnd = game.createWindow("游戏大厅");
        wnd.addItem('创建房间', newRoom);
        wnd.addItem('进入房间', joinRoom);
        return wnd;
    }

    function createNewRoomWindow() {
        var wnd = game.createWindow('创建房间');
        wnd.txtNick = wnd.addItem('昵称', function () {
            game.nick = this.value;
        }, 'text');
        wnd.addItem('创建', newRoomCreate);
        wnd.addItem('关闭', newRoomCancel);
        return wnd;
    }

    function createJoinRoomWindow() {
        var wnd = game.createWindow('进入房间');
        wnd.txtNick = wnd.addItem('昵称', function () {
            game.nick = this.value;
        }, 'text');
        wnd.txtRoomNo = wnd.addItem('房间号', function () {
            roomNo = parseInt(wnd.txtRoomNo.getValue());
        }, 'number');
        wnd.txtRoomNo.elInput.addEventListener('blur', function () {
            wnd.txtRoomNo.setValue(isNaN(roomNo) ? "" : "" + roomNo);
        });
        wnd.addItem('加入', joinRoomJoin);
        wnd.addItem('关闭', joinRoomCancel);
        return wnd;
    }

    function getSocket() {
        if (!socket) {
            socket = game.newConnection();
            if (!socket) {
                game.showStatus('无法连接到服务器(网络忙)', 5000);
                return false;
            }
            socket.onerror = function (e) {
                game.showStatus("无法连接到服务器.", 5000);
                socket.release();
                socket = null;
            };
            // 监听Socket的关闭
            socket.onclose = function (event) {
                game.showStatus("服务器异常", 5000);
                socket.release();
                socket = null;
            };
        }
        return true;
    }

    function newRoomCreate() {
        if (game.nick == "") {
            game.showStatus("请输入昵称！", 2000);
            return;
        }

        game.showStatus('连接服务器');
        if (!getSocket())
            return;
        socket.onopen = function (event) {
            socket.onmessage = function (event) {
                var msg = JSON.parse(event.data);
                if (msg.error) {
                    game.showStatus(msg.error);
                }
                if (msg.roomId !== undefined) {
                    mainWnd.hide();
                    game.hideStatus();
                    game.mafia = new GameMafia(msg.roomId);
                    game.mafia.addPlayer(game.userId, game.nick);
                } else if (msg.userId !== undefined) {
                    game.userId = msg.userId;
                } else {
                    socket.close();
                }

            };

            socket.send(JSON.stringify({
                command: 'createRoom',
                nick: game.nick
            }));
        };
        newRoomWnd.hide();
    }

    function newRoomCancel() {
        newRoomWnd.hide();
    }

    function newRoom() {
        newRoomWnd.popup('200pt', '200pt');
        newRoomWnd.txtNick.elInput.value = game.nick;
        newRoomWnd.txtNick.elInput.focus();
    }

    function joinRoomJoin() {
        if (game.nick == "") {
            game.showStatus("请输入昵称！", 2000);
            return;
        }
        if (isNaN(roomNo)) {
            game.showStatus("请输入房间号", 2000);
            return;
        }
        game.showStatus('连接服务器');

        if (!getSocket())
            return;

        socket.onopen = function (event) {
            socket.onmessage = function (event) {
                var msg = JSON.parse(event.data);
                switch (msg.type) {
                    case 'error':
                        game.showStatus(msg.error);
                        break;
                    case 'joinRoom':
                        joinRoomWnd.hide();
                        game.hideStatus();
                        mainWnd.hide();
                        game.mafia = new GameMafia(msg.roomId);
                        game.mafia.perform(msg);
                        break;
                    default:
                        if (msg.userId !== undefined) {
                            game.userId = msg.userId;
                        } else {
                            socket.close();
                        }
                }
            };

            socket.send(JSON.stringify({
                command: 'joinRoom',
                nick: game.nick,
                roomId: roomNo
            }));
        };
    }

    function joinRoomCancel() {
        joinRoomWnd.hide();
    }

    function joinRoom() {
        joinRoomWnd.popup('200pt', '200pt');
        joinRoomWnd.txtNick.elInput.value = game.nick;
        joinRoomWnd.txtNick.elInput.focus();
    }

    mainWnd.show();
    game.hall = {
        debug: function () {
            roomNo = -1;
            joinRoom();
            joinRoomJoin();
        }
    }
}).apply(window);