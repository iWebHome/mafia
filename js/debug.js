/**
 * Created by xuan on 15-6-24.
 */

window.addEventListener('load', function () {
    "use strict";
//FIXME Debug usage
    game.nick = location.hash;
    document.title = game.nick;
    game.hall.debug();
    var inval = setInterval(function () {
        if (game.mafia) {
            if (game.mafia.ready())
                clearInterval(inval);
        }
    }, 500);
//Debug end here
});
