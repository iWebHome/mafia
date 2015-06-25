/**
 * License: Apache License 2.0
 * Author: kXuan <kxuanobj@gmail.com>
 *
 * Submit your issue to https://github.com/Kxuan/mafia/issues
 */
function encodeHTML(text){
    "use strict";
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}
window.game = new function () {
    "use strict";
    var stage, status, socket;

    function GameItemInput(body, label, type, onchange) {
        this.body = body;
        var tr, tdLabel, tdInput;

        this.el = document.createElement('table');
        this.elInput = document.createElement('input');
        this.elInput.id = 'random' + Math.random();
        this.elLabel = document.createElement('label');

        tr = this.el.insertRow();
        tdLabel = tr.insertCell();
        tdInput = tr.insertCell();
        tdInput.style.paddingRight = '2px';

        tdLabel.appendChild(this.elLabel);
        tdInput.appendChild(this.elInput);

        this.el.className = 'gameItemInput';
        this.elLabel.className = 'gameItemInputLabel';
        this.elInput.className = 'gameItemInputInput';

        this.elInput.type = type;
        this.elLabel.innerText = label;
        this.elLabel.for = this.elInput.id;

        if (onchange) {
            this.elInput.addEventListener('change', onchange);
        }
        body.el.appendChild(this.el);
        this.getValue = function () {
            return this.elInput.value;
        };
        this.setValue = function (value) {
            this.elInput.value = value;
        };
    }

    function GameItemButton(body, text, onclick) {
        this.body = body;
        this.el = document.createElement('button');
        this.el.className = 'gameItemButton';
        this.el.innerText = text;
        this.el.addEventListener('click', onclick);
        this.body.el.appendChild(this.el);

        this.setText = function (text) {
            this.el.innerText = text;
        }
    }

    function GameWindowBody(wnd) {
        this.wnd = wnd;
        this.el = document.createElement('div');
        this.items = [];
        this.add = function addItem(text, onaction, type) {
            var item;
            switch (type) {
                case 'number':
                case 'text':
                    item = new GameItemInput(this, text, type, onaction);
                    break;
                case 'button':
                default :
                    item = new GameItemButton(this, text, onaction);
            }
            this.items.push(item);
            return item;
        };
        this.el.className = 'gameBody';
        this.wnd.appendChild(this.el);
    }

    function GameWindow(title) {
        this.el = document.createElement('div');
        this.body = null;
        this.wndMasker = null;

        this.show = function show() {
            //this.el.style.display = 'block';
            stage.appendChild(this.el);
        };
        this.hide = function hide() {
            stage.removeChild(this.el);
            //this.el.style.display = 'none';
            if (this.wndMasker) {
                game.removeMasker(this.wndMasker);
                this.wndMasker = null;
            }
        };
        this.popup = function popup(width, height) {
            this.el.style.position = 'absolute';
            this.el.style.width = width;
            this.el.style.height = height;
            //this.el.style.zIndex = 100;
            if (!this.wndMasker)
                this.wndMasker = game.addMasker();
            this.show();
            var pw, ph;
            pw = document.body.scrollWidth;
            ph = document.body.scrollHeight;
            this.el.style.left = ((pw - this.el.offsetWidth) / 2) + 'px';
            this.el.style.top = ((ph - this.el.offsetHeight) / 2) + 'px';
        };

        this.addItem = function addItem(text, onclick, type) {
            if (this.body === null) {
                this.body = new GameWindowBody(this);
            }
            return this.body.add(text, onclick, type);
        };

        this.el.className = 'gameWindow';
        if (title !== undefined) {
            this.elTitle = document.createElement('h1');
            this.elTitle.className = 'gameWndTitle';
            this.elTitle.innerText = title;
            this.el.appendChild(this.elTitle);
        }
        this.appendChild = this.el.appendChild.bind(this.el);
    }

    function GameStatusWindow() {
        var wnd = new GameWindow();
        var statusBar = document.createElement('div');
        statusBar.className = 'gameStatusWindowStatusBar';

        wnd.el.appendChild(statusBar);
        this.show = function show(text) {
            statusBar.innerText = text;
            wnd.popup();
            wnd.wndMasker.addEventListener('click', this.hide);
        };
        this.hide = wnd.hide.bind(wnd);
    }

    this.newConnection = function newConnection() {
        if (socket === undefined) {
            socket = new WebSocket("ws://g.ixuan.org:1561", "mafia");
            socket.release = function () {
                if (socket.readyState != WebSocket.CLOSED &&
                    socket.readyState != WebSocket.CLOSING) {
                    socket.close();
                }
                socket = void 0;
            };
            return socket;
        } else {
            return null;
        }
    };
    this.getConnection = function getConnection() {
        return socket;
    };
    this.showStatus = function showStatus(text, timeout) {
        status.show(text);
        if (timeout !== undefined) {
            setTimeout(this.hideStatus, timeout);
        }
    };
    this.hideStatus = function hideStatus() {
        status.hide();
    };
    this.createWindow = function createWindow(title) {
        return new GameWindow(title);
    };
    this.addMasker = function addMasker() {
        var el = document.createElement("div");
        el.className = 'gameMasker';
        stage.appendChild(el);
        return el;
    };
    this.removeMasker = function removeMasker(el) {
        stage.removeChild(el);
    };
    this.perform = function perform(msg) {
        switch (msg.type){
            case 'reload-force':
                location.reload(1);
                return;
        }
    };

    this.userId = -1;
    this.nick = '';
    stage = document.createElement('section');
    document.body.insertBefore(stage, document.body.firstChild);
    status = new GameStatusWindow();
};
document.onselectstart = function (e) {
    if (e.preventDefault)
        e.preventDefault();
    return false;
};