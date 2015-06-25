/**
 * License: Apache License 2.0
 * Author: kXuan <kxuanobj@gmail.com>
 *
 * Submit your issue to https://github.com/Kxuan/mafia/issues
 */
function GameMafia(roomId) {
    "use strict";

    var MainWnd = createMainWindow();
    var socket = game.getConnection();
    var onPlayerListSelect, onPassPressed;

    var players = [];
    var isPlayerReady = false, isPlayerAlive = true;
    var speakingId;
    var playerRole;
    var gameStatus = 'P';
    var roundTime, stepRemain;
    var progressUpdater;

    function createMainWindow() {
        var wnd = game.createWindow("天黑请闭眼");
        var roomInfo = document.createElement('section');
        var playerList = document.createElement('section');
        var playerListTitle = document.createElement('h2');
        var playerListTable = document.createElement('table');
        roomInfo.className = 'mafiaRoomInfo';
        playerList.className = 'mafiaPlayerList';
        playerListTitle.className = 'mafiaPlayerListTitle';
        playerListTable.className = 'playerListTable';
        wnd.elRoomInfo = roomInfo;
        wnd.elPlayerList = playerList;
        wnd.elPlayerTable = playerListTable;
        wnd.elPlayerListTitle = playerListTitle;

        playerListTitle.innerText = '>玩家列表';

        playerList.appendChild(playerListTitle);
        playerList.appendChild(playerListTable);

        wnd.appendChild(roomInfo);
        wnd.appendChild(playerList);

        wnd.readyBtn = wnd.addItem('准备', onReadyClick);
        wnd.cancelBtn = wnd.addItem('退出', window.close);
        return wnd;
    }

    function setReadyButton(text, className) {
        MainWnd.readyBtn.el.innerText = text;
        MainWnd.readyBtn.el.className = className;
    }

    function updateRoomInfo() {
        var npcCount = 0;
        if (players.length >= 6)
            npcCount++;
        if (players.length >= 9)
            npcCount++;
        if (players.length >= 13)
            npcCount++;
        if (players.length >= 17)
            npcCount++;
        var userInfo = '';
        if (gameStatus != 'P') {
            switch (playerRole) {
                case 'P':
                    userInfo += '你是<span style="color: blue; font-weight: bold; font-size: 12pt">警察</span>';
                    break;
                case 'K':
                    userInfo += '你是<span style="color: gold; font-weight: bold; font-size: 12pt">杀手</span>';
                    break;
                case 'V':
                    userInfo += '你是<span style="color: green; font-weight: bold; font-size: 12pt">平民</span>';
                    break;
            }
            if (!isPlayerAlive) {
                userInfo += '<span style="color: red; font-weight: bold; font-size: 16pt">你挂了</span>';
            }
        }
        MainWnd.elRoomInfo.innerHTML =
            "房间号:" + roomId + "\n" +
            "警察:" + npcCount + "人\n" +
            "杀手:" + npcCount + "人\n" + userInfo;
    }

    function updateReadyStatus(playerId, isReady) {
        var player = setPlayerStatus(playerId, isReady ? '准备' : '');
        player.ready = isReady;

        if (playerId == game.userId && !isRoomMaster()) {
            isPlayerReady = isReady;
            if (isReady) {
                setReadyButton('取消', 'mafiaButtonGold');
            } else {
                setReadyButton('准备', 'gameItemButton');
            }
        }
    }

    this.addPlayer = function (id, nick, ready) {
        var row = MainWnd.elPlayerTable.insertRow();
        var statusCell = row.insertCell();
        var nickCell = row.insertCell();
        var markCell = row.insertCell();
        var player;

        row.addEventListener('click', function () {
            if (onPlayerListSelect)
                onPlayerListSelect(player);
        });

        nickCell.innerText = nick;
        markCell.style.display = 'none';
        player = {
            id: id,
            ready: !!ready,
            nick: nick,
            row: row,
            nickCell: nickCell,
            statusCell: statusCell,
            markCell: markCell
        };
        players.push(player);
        if (players.length == 1) {
            setPlayerStatus(player, '房主');

            if (id == game.userId) {
                setReadyButton('开始', 'mafiaButtonRed');
            }
        } else {
            if (player.ready) {
                setPlayerStatus(player, '准备');
            }
        }
        updateRoomInfo();
    };
    this.removePlayer = function (id) {
        var player;
        players = players.filter(function (v) {
            if (v.id == id) {
                player = v;
                return false;
            } else {
                return true;
            }
        });
        if (player.row === MainWnd.elPlayerTable.rows[0]) {
            //房主更变
            setPlayerStatus(players[0], '房主');

            if (players[0].id == game.userId) {
                setReadyButton('开始', 'mafiaButtonRed');
            }
        }
        player.row.parentElement.removeChild(player.row);
        updateRoomInfo();
    };
    function getPlayer(playerId) {
        for (var i = 0; i < players.length; i++) {
            if (players[i].id == playerId) {
                return players[i];
            }
        }
        return null;
    }

    function setPlayerStatus(playerId, status) {
        var p;
        if (typeof playerId == 'number') {
            p = getPlayer(playerId);
        } else {
            p = playerId;
        }
        p.row.style.backgroundColor = '';
        p.row.style.textDecoration = '';
        switch (status) {
            case '房主':
                p.statusCell.style.backgroundColor = 'red';
                break;
            case '准备':
                p.statusCell.style.backgroundColor = 'green';
                break;
            case '警察':
                p.statusCell.style.backgroundColor = 'blue';
                break;
            case '杀手':
                p.statusCell.style.backgroundColor = 'gold';
                break;
            case '平民':
                p.statusCell.style.backgroundColor = 'green';
                break;
            case 'XX':
                p.row.style.textDecoration = 'line-through';
                //XX不被标记
                return;
            case '':
                p.statusCell.style.backgroundColor = 'white';
                break;
            default:
                status = '未知';
                p.statusCell.style.backgroundColor = 'black';
        }
        p.statusCell.innerText = status;
        return p;
    }

    function setPlayerMark(playerId, mark) {
        var p;
        if (typeof playerId == 'number') {
            p = getPlayer(playerId);
        } else {
            p = playerId;
        }

        p.markCell.innerHTML = mark;
    }

    function clearVote() {
        players.forEach(function (p) {
            p.markCell.innerText = '';
        });
    }

    function votePlayer(playerId, toId, confirmed) {
        if (toId) {
            var to = getPlayer(toId);
            if (to) {
                if (confirmed) {
                    setPlayerMark(playerId, '<span style="color: red;font-weight: bold;">选择' + encodeHTML(to.nick) + '</span>');
                    if (playerId == game.userId)
                        setReadyButton('确认', 'gameDisabledButton');
                } else {
                    setPlayerMark(playerId, '选择' + encodeHTML(to.nick));
                    if (playerId == game.userId)
                        setReadyButton('确认', 'mafiaButtonGold');
                }
            }
        } else {
            setPlayerMark(playerId, '取消选择');
            setReadyButton('确认', 'gameDisabledButton');
        }
    }

    function isRoomMaster(playerId) {
        if (playerId === undefined)
            playerId = game.userId;
        return playerId == players[0].id;
    }

    function onReadyClick() {
        switch (gameStatus) {
            case 'P':
                if (isRoomMaster()) {
                    if (players.length < 6) {
                        game.showStatus('玩家数过少', 5000);
                        return false;
                    }

                    for (var i = 1; i < players.length; i++) {
                        if (!players[i].ready) {
                            game.showStatus("请等待所有玩家准备", 2000);
                            return false;
                        }
                    }

                    socket.send(JSON.stringify({
                        command: 'start'
                    }));
                    return true;
                } else {
                    socket.send(JSON.stringify({
                        command: 'ready',
                        isReady: !isPlayerReady
                    }));
                    return true;
                }
            default :
                if ((MainWnd.readyBtn.el.innerText == 'PASS'
                    || MainWnd.readyBtn.el.innerText == '确认'
                    )
                    && MainWnd.readyBtn.className != 'gameDisabledButton') {
                    socket.send(JSON.stringify({
                        command: 'pass'
                    }));
                }
        }

    }

    function enablePlayerSelect(onselect, playerList) {
        if (typeof onselect == 'function')
            onPlayerListSelect = onselect;
        if (playerList === undefined) {
            for (var i = 0; i < players.length; i++) {
                if (players[i].isAlive) {
                    players[i].row.style.backgroundColor = '#009afd';
                } else {
                    players[i].row.style.backgroundColor = 'grey';
                }
            }
        } else {
            for (var i = 0; i < players.length; i++) {
                if (playerList.indexOf(players[i]) >= 0) {
                    players[i].row.style.backgroundColor = '#009afd';
                } else {
                    players[i].row.style.backgroundColor = 'grey';
                }
            }
        }
    }

    function disablePlayerSelect() {
        onPlayerListSelect = null;
        for (var i = 0; i < players.length; i++) {
            players[i].row.style.backgroundColor = 'white';
        }
    }

    function updateProgress() {
        var status = '';
        updateRoomInfo();
        switch (gameStatus) {
            case 'G':
                if (playerRole != 'V') {
                    status = '请确认同伴身份';
                } else {
                    status = '请等待';
                }
                break;
            case 'N':
                switch (playerRole) {
                    case 'V':
                        status = '天黑请闭眼';
                        break;
                    case 'P':
                        status = '查验身份';
                        break;
                    case 'K':
                        status = '选择行凶对象';
                        break;
                }
                break;
            case 'S':
                if (speakingId == game.userId) {
                    status = '请留遗言';
                } else {
                    status = getPlayer(speakingId).nick + '发表遗言中';
                }
                break;
            case 'D':
                if (speakingId == game.userId) {
                    status = '轮到你发言了';
                } else {
                    status = getPlayer(speakingId).nick + '发言中';
                }
                break;
            case 'V':
                status = "请公投";
                break;
        }
        MainWnd.elPlayerListTitle.innerText = status + '剩余' + stepRemain + "秒";
        progressUpdater = setTimeout(updateProgress, 1000);
        stepRemain--;
    }

    function newProgress() {
        if (progressUpdater) {
            clearTimeout(progressUpdater);
            progressUpdater = 0;
        }
        updateProgress();
    }

    function applyStatus(status, msg) {
        if (msg.roundTime) {
            stepRemain = roundTime = msg.roundTime;
        }
        gameStatus = status;
        disablePlayerSelect();

        switch (status) {
            case 'G':
                playerRole = msg.role;
                isPlayerAlive = true;
                setReadyButton('PASS', 'gameDisabledButton');
                players.forEach(function (p) {
                    setPlayerStatus(p, '');
                    p.isAlive = true;
                    p.markCell.style.display = 'table-cell';
                });
                switch (msg.role) {
                    case 'P':
                        msg.buddy.forEach(function (pid) {
                            var p = getPlayer(pid);
                            if (p) {
                                setPlayerStatus(p, '警察');
                                p.role = 'P';
                            }
                        });
                        break;
                    case 'K':
                        msg.buddy.forEach(function (pid) {
                            var p = getPlayer(pid);
                            if (p) {
                                setPlayerStatus(p, '杀手');
                                p.role = 'K';
                            }
                        });
                        break;
                    case 'V':
                        break;
                }
                break;
            case 'N':
                if (!isPlayerAlive)
                    break;
                switch (playerRole) {
                    case 'P':
                        setReadyButton('确认', 'gameDisabledButton');
                        enablePlayerSelect(function (p) {
                            if (p.isAlive && p.role != 'P') {
                                socket.send(JSON.stringify({
                                    command: 'check',
                                    to: p.id
                                }));
                            }
                        }, players.filter(function (p) {
                            return p.isAlive && p.role != 'P';
                        }));
                        break;
                    case 'K':
                        setReadyButton('确认', 'gameDisabledButton');
                        enablePlayerSelect(function (p) {
                            if (p.isAlive && p.role != 'K') {
                                socket.send(JSON.stringify({
                                    command: 'kill',
                                    to: p.id
                                }));
                            }
                        }, players.filter(function (p) {
                            return p.isAlive && p.role != 'K';
                        }));
                        break;
                    case 'V':
                        break;
                }
                break;
            case 'D':
                setReadyButton('PASS', 'gameDisabledButton');
                if (!isPlayerAlive)
                    break;
                break;
            case 'S':
                speakingId = msg.playerId;
                if (msg.playerId == game.userId) {
                    setReadyButton('PASS', 'mafiaButtonGold');
                } else {
                    setReadyButton('PASS', 'gameDisabledButton');
                }
                break;
            case 'V':
                if (!isPlayerAlive)
                    break;
                setReadyButton('确认', 'gameDisabledButton');
                var votesPlayer = players.filter(function (p) {
                    return msg.votes.indexOf(p.id) >= 0;
                });
                enablePlayerSelect(function (p) {
                    if (p.isAlive && p.role != 'K') {
                        socket.send(JSON.stringify({
                            command: 'vote',
                            to: p.id
                        }));
                    }
                }, votesPlayer);
                break;
            case 'OK':
                game.showStatus('杀手获胜');
                clearTimeout(progressUpdater);
                break;
            case 'OP':
                game.showStatus('警民获胜');
                clearTimeout(progressUpdater);
                break;
        }
        clearVote();
        newProgress();
    }

    if (socket === null) {
        alert('游戏异常，即将重新载入');
        location.reload(true);
        return;
    }
    socket.onerror = function () {
        game.showStatus('网络错误，请重新登录。');
    };

    this.ready = function () {
        if (!isRoomMaster())
            return onReadyClick();
    };
    this.perform = function (msg) {
        switch (msg.type) {
            case 'playerReady':
                updateReadyStatus(msg.playerId, msg.isReady);
                break;
            case 'playerJoin':
                this.addPlayer(msg.playerId, msg.nick);
                break;
            case 'playerQuit':
                this.removePlayer(msg.playerId);
                break;
            case 'gameStart':
                applyStatus('G', msg);
                break;
            case 'gameStatus':
                applyStatus(msg.status, msg);
                break;
            case 'gameOver':

                msg.players.forEach(function (p) {
                    switch (p.role) {
                        case 'V':
                            setPlayerStatus(p.id, '平民');
                            break;
                        case 'P':
                            setPlayerStatus(p.id, '警察');
                            break;
                        case 'K':
                            setPlayerStatus(p.id, '杀手');
                            break;
                    }
                });
                applyStatus(msg.status, msg);
                break;
            case 'nextSpeaker':
                if (msg.prev) {
                    setPlayerMark(msg.prev, '');
                    if (msg.prev == game.userId) {
                        setReadyButton('PASS', 'gameDisabledButton');
                    }
                }
                setPlayerMark(msg.speaker, "发言中");
                speakingId = msg.speaker;
                stepRemain = roundTime;
                if (msg.speaker == game.userId) {
                    setReadyButton('PASS', 'mafiaButtonGold');
                }
                break;
            case 'role':
                switch (msg.role) {
                    case 'P':                        //What ??
                        setPlayerStatus(msg.playerId, '警察');
                        break;
                    case 'K':
                        setPlayerStatus(msg.playerId, '杀手');
                        break;
                    case 'V':
                        setPlayerStatus(msg.playerId, '平民');
                        break;
                }
                break;
            case 'ready':
                updateReadyStatus(game.userId, msg.isReady);
                break;
            case 'joinRoom':
                for (var i = 0; i < msg.players.length; i++) {
                    this.addPlayer(msg.players[i].id, msg.players[i].nick, msg.players[i].ready);
                }
                break;
            case 'pass':
                votePlayer(msg.playerId, msg.to, true);
                break;
            case 'check':
            case 'kill':
            case 'vote':
                votePlayer(msg.playerId, msg.to);
                break;
            case 'dead':
                if (game.userId == msg.playerId) {
                    game.showStatus('你挂了～');
                    isPlayerAlive = false;
                }
                setPlayerStatus(msg.playerId, 'XX');
                break;
            default :
                return game.perform(msg);
        }
    };
    socket.onmessage = function (e) {
        this.perform(JSON.parse(e.data));
    }.bind(this);
    MainWnd.show();
}