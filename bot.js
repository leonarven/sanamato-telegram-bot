const        TelegramBot = require( 'node-telegram-bot-api' );
const OfflineTelegramBot = require( './OfflineTelegramBot' );

const { GameAbstract } = require( './game.js' );

const { Chat } = OfflineTelegramBot;
const games = {};

const argv  = require('minimist')(process.argv.slice(2));
console.log("INIT :: argv:", argv );

const TOKEN     = (argv.token.trim());
const ADMIN_IDS = (argv.admins || "").toString().split( "," ).map( id => id.trim() ).filter( id => id );

if (!TOKEN) throw "Missing parameter --token";

const bot = new (require( argv.offline ? './OfflineTelegramBot' : 'node-telegram-bot-api' ))( TOKEN, { polling: true });


const __messages = [];
var __messageSendTimeout = null;

__messages.push = function() { var ret = Array.prototype.push.apply( __messages, arguments ); setTimeout(__refreshMessageSends); return ret; };

function sendMessage( chatId, message, opts = {} ) {
	if (typeof opts.disable_notification == "undefined") opts.disable_notification = true; 

	if (chatId instanceof Chat) chatId = chatId.id;
	else if (typeof chatId == "object" && typeof chatId.id != "undefined") chatId = chatId.id;

	if (chatId == null) {
		return Promise.resolve( console.log( "sendMessage() :: Message not sended, no chatId" ));
	}


	if (!Array.isArray( message )) message = [ message ];
	
	return message.forEach(( msg, i ) => __messages.push([ chatId, msg, opts ]));
}
function __refreshMessageSends() {
	if (__messageSendTimeout) return;
	if (__messages.length > 0) {
		__messageSendTimeout = setTimeout(message => {
			__messageSendTimeout = null;
			
			if (!message) return;

			console.log( "sendMessage( chatId, msg, opts ) ::", message );
		
			bot.sendMessage.apply( bot, message ).then(() => {
				/**/
			}).catch( err => {
				console.error( "ERROR@__refreshMessageSends()-cycle :: bot.sendMessage got rejected:", err, "message:", message );
			}).finally( __refreshMessageSends );
		}, 250, __messages.splice( 0, 1 )[0]);
	} 
}
Chat.prototype.sendMessage = function( messages, opts ) {
	return sendMessage( this.id, messages, opts );
};

bot.on('polling_error', err => {
	console.error( "ERROR at bot.on(polling_error) ::", err );

	if (err.code == "EFATAL") {
		console.error( "Got EFATAL error. Exiting" );
		process.exit();
	}
});


bot.on('text', msg => {
	console.debug( "bot.on('text', (msg)) ::", msg );
	const chatId = msg.chat && msg.chat.id || null;
	const chat = msg.chat = Chat.get( msg.chat );

	if (chatId) {
		const game = games[ chatId ];

		if (game) {
			if (msg.from && !msg.from.is_bot) {
				if (!game.players[ msg.from.id ]) {
					game.players[ msg.from.id ] = msg.from;
					game.players[ msg.from.id ].$msgs = [];
					game.players[ msg.from.id ].label = msg.from.first_name || msg.from.username || msg.from.id;
				}
				game.players[ msg.from.id ].$msgs.push( msg );
			}
		}
	}
});



/**
 * Komennon /peli käsittely
 * /peli /^\d+/ = A-pituinen kierros
 * /peli /^\d+/ /^\d+/ = A-pituinen kierros B-kokoisella laudalla
 * /peli /^\d+/ /^\d+/ xyz = A-pituinen kierros B-kokoisella laudalla käyttäen merkistöä xyz
 *
 * @param {number} [match[1]=5]    - Käytetyn laudan koko
 * @param {number} [match[2]=null] - Kierroksen pituus
 * @param {string} [match[3]=FIN]  - Käytetty kirjaimisto tai sen koodi
 *
 *          -> CMD       |timeout   |size      |chars */
(() => {
	const cmdMatchRegExp = /^\/peli(?:\s+(\d+)(?:\s+(\d+)(?:\s+(.+))?)?)?\s*$/;
	console.log( "INIT :: Initializing /peli,", cmdMatchRegExp );
	bot.onText( cmdMatchRegExp, (msg, match) => {
		console.debug( "bot.onText(\/start, ( msg, match )) :: ", msg, match );

		try {
			return sendMessage( msg.chat.id, "/peli toistaiseksi poissa käytöstä." );

			handleCmdPeli( msg, {
				size:    match[1] == null ? 5     : parseInt(match[1]),
				timeout: match[2] == null ? null  : parseInt(match[2]),
				chars:   match[3] == null ? "FIN" : match[3]
			});
		} catch( err ) {
			console.error( "ERROR at bot.onText(\/start) ::", err );
			sendMessage( msg.chat.id, `Virhe komennon käsittelyssä!\n${ err }`);
		}
	});
})();



/**
 * Komennon /kisa käsittely
 * /kisa /^\d+/ = A-kokoisella laudalla järjestetty manuaalisesti lopetettava peli, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ = A-kokoisella laudalla järjestetty, B-pituinen peli, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ /^\d+/ = A-kokoisella laudalla järjestettyjä, B-pituisia pelejä C-kpl, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ /^\d+/ /^\d+/ = A-kokoisella laudalla järjestettyjä B-pituisia D-välein pelattavia ohjattuja kierroksia C-kpl joiden, jonka pisteet lasketaan
 * /kisa /^\d+/ /^\d+/ /^\d+/ /^\d+/ xyz = A-kokoisella laudalla järjestettyjä merkistöä zyx käyttäviä B-pituisia D-välein pelattavia ohjattuja kierroksia C-kpl joiden, jonka pisteet lasketaan
 *
 * @param {number} (match[1]=5)   - Käytetyn laudan koko
 * @param {number} (match[2]=120) - Kierroksen pituus, jos halutaan
 * @param {number} (match[3=1)]   - Kierrosten lukumäärä
 * @param {number} (match[4])     - Automaatiolla (jos asetettu) määritelty kierrosten välinen aika
 * @param {string} (match[5]=FIN) - Käytetty kirjaimisto tai sen koodi
 *
 *          -> CMD       |size      |timeout   |rounds    |delay     |chars */
(()=>{
	const cmdMatchRegExp = /^\/kisa(?:\s+(\d+)(?:\s+(\d+)(?:\s+(\d+)(?:\s+(\d+)(?:\s+(.+))?)?)?)?)?\s*$/;
	console.log( "INIT :: Initializing /kisa,", cmdMatchRegExp );
	bot.onText( cmdMatchRegExp, (msg, match) => {
		console.debug( "bot.onText(\/kisa, ( msg, match )) :: ", msg, match );
		try {
			runKisa( Chat.get( msg.chat.id ), {
				size:    match[1] == null ? 5     : parseInt(match[1]),
				timeout: match[2] == null ? 120   : parseInt(match[2]),
				rounds:  match[3] == null ? 1     : parseInt(match[3]),
				delay:   match[4] == null ? null  : parseInt(match[4]),
				chars:   match[5] == null ? "FIN" : match[5]
			});
		} catch( err ) {
			console.error( "ERROR at bot.onText(\/start) ::", err );
			sendMessage( msg.chat.id, `Virhe komennon käsittelyssä!\n${ err }`);
		}
	});
})();



/**
 */
console.log( "INIT :: Initializing /stop" );
bot.onText(/^\/stop$/, (msg, match) => {
	console.debug( "bot.onText(\/stop, ( msg, match )) :: ", msg, match );

	try {
		handleCmdStop( msg, match );
	} catch( err ) {
		console.error( "ERROR at bot.onText(\/stop) ::", err );
	}

	function handleCmdStop( msg, match ) {
		console.debug( "handleCmdStop( msg, opts ) ::", arguments );

		const chatId = msg.chat.id;
		const game = games[ chatId ];

		if (!game) return sendMessage( chatId, "Ei peliä, joka lopettaa!" );

		sendMessage( chatId, "Peli keskeytetty!" );

		game.stop();
	}
});



/**
 */
(manual => {
	console.log( "INIT :: Initializing /help" );
	bot.onText(/^\/help$/, msg => {
		sendMessage( msg.chat.id, manual );
	});
})(`/peli - Aloita yhden kierroksen peruspeli (parametrit: /peli <koko=5> <aika=120> <kirjaimisto=FIN>).

/kisa - Aloita kilpailu (parametrit: /kisa <koko=5> <aika=120> <kierroksia=1> <kierrosten väli> <kirjaimisto=FIN>).

/stop - Lopeta nykyinen peli.

/help - Näytä tämä listaus.`);



/**
 */
if (ADMIN_IDS.length > 0) { 
	console.log( "INIT :: ADMIN_IDS > 0:", ADMIN_IDS );
	console.log( "INIT :: Initializing /die" );
	bot.onText(/^\/die$/, msg => {
		if (process.uptime() > 2 && ADMIN_IDS.indexOf( msg.from.id.toString() ) != -1) {
			sendMessage( msg.chat.id, "Minä menen nyt..." ).then(() => process.exit()).catch( err => { });
		}
	});
}

/**
 */

(() => {
	console.log( "INIT :: Initializing /echo" );
	bot.onText(/^\/echo\s+(.+)/, (msg, match) => {
		sendMessage( msg.chat, match[1]);
	});
})();

/************************************************/

/**
 * @param {number}  [opts.size=5]               - Käytetyn laudan koko
 * @param {number}  [opts.timeout=Infinity]     - Kierroksen pituus
 * @param {number}  [opts.rounds=1]             - Kierrosten lukumäärä
 * @param {number}  [opts.delay=Infinity]       - Kierrosten välinen aika
 * @param {string}  [opts.chars=FIN]            - Käytetty kirjaimisto tai sen koodi
 * @param {boolean} [opts.disable_scores=false] - Jätetäänkö pisteidenlasku toteuttamatta
 */
function runKisa( chat, opts ) {
	console.debug( "handleCmdKisa( chat, opts ) ::", arguments );

	if (games[ chat.id ]) return sendMessage( chat.id, `Peli on jo käynnissä, aloitettu ${ games[ chat.id ].ctime.toLocaleString() }! Komenna /stop lopettaaksesi.` );

	parseOpts( opts );

	if (opts.size > 10) {
		throw `Virheellinen asetus. Laudan sivun pituus voi olla korkeintaan 10 merkkiä (${ opts.size } > 10).`;
	}

	if (opts.rounds > 1 && (typeof opts.delay != "number" || !isFinite( opts.delay ))) {
		throw "Not implemented yet (opts.delay unsetted)!\nUseamman kierroksen kisaa ei voi käynnistää ilman aikavälin asettamista"; 
	}

	if (isFinite( opts.timeout ) && opts.timeout > 0) {
		opts.timeoutFn = game => {
			game.stop();
		};

		opts.timeoutFn.tMinus = {
			60 : game => chat.sendMessage( `Minuutti aikaa jäljellä.` ),
			5  : game => chat.sendMessage( `Aikaa jäljellä viisi sekuntia!` )
		};
	} else {
		throw "Not implemented yet (opts.timeout unsetted)!\nAseta kisan kesto (esim. /kisa 6 120)"; 
	}

	iterateRound( 1, () => {
		chat.sendMessage( "Kilpailu päättyi. Kiitos kaikille " + String.fromCodePoint( 0x1F60A ));
	});

	function iterateRound( round = 1 , callback ) {
		runRound( round, ( err, game ) => {
			console.log("runRound.callback()");

			if (err) {
				console.error( "ERROR@runRound() ::", err );
				return;
			}

			if (opts.disable_scores) {
				chat.sendMessage( `Aika loppui, peli päättyi!` );
			} else {
				var scores = game.getScores(), score_txts = [];
				var all_invalids = [];

				console.log( "iterateRound() :: scores:", scores );

				for (var id in scores) {
					var score_txt = "";
					var score = scores[id];
					var words = score.words.map( word => `<i>${ word.toLowerCase() }</i>` );
					score_txt += "\n\n@" + (game.players[id].username || `${ id } (${ game.players[id].label })`) + ", ";
					
					if (words.length == 0) {
						score_txt += "ei löydettyjä sanoja."
					} else if (words.length == 1) {
						score_txt += `yksi löydetty sana, ${ words[0] }.`
					} else {
						if (Object.keys( scores ).length == 1) {
							score_txt += `${ words.length } sanaa.`;
						} else {
							if (score.words.length == score.uniques.length) {
								score_txt += `<b>${ words.length } sanaa, kaikki uniikkeja.</b>`;
							} else {
								score_txt += `<b>${ words.length } sanaa, ${ score.uniques.length } uniikkia.</b>`;
							}
						}
				
						score_txt += `\n${ words[0] }`;
						for (var c = words.length, i = c-1; i >= 1; i--) {
							score_txt += (i==1 ? " ja " : ", ") + words[c-i];
						}
						score_txt += ".";
					}

					for (var word of score.invalids) {
						if (all_invalids.indexOf( word ) == -1) all_invalids.push( word );
					}
					all_invalids = all_invalids.map( word => `<i>${ word.toLowerCase() }</i>` );

					for (var word in score.founds) {
						var paths = score.founds[word];
						for (var path of paths) {
//							score_txt += `\n${word} - ${ path }`;
						}
					}

					score_txts.push( score_txt );
				}

				if (score_txts.length == 0) {
					score_txts.unshift( "Aika loppui, peli päättyi. Kukaan ei pelannut " + String.fromCodePoint( 0x1F636 ));
				} else {
					score_txts.unshift( "Aika loppui, peli päättyi.\n<b>Tulokset:</b>" );
				}

				if (all_invalids.length == 1) {
					score_txts.push( `Sanaa ${ all_invalids[0] } ei hyväksytty.`);
				} else if (all_invalids.length > 1) {
					score_txts.push( `Sanoja ${ all_invalids.join( ', ' ) } ei hyväksytty.`);
				}

				chat.sendMessage( score_txts, { parse_mode: 'HTML'} );
			}

			if (opts.rounds > 1) {
				if (round < opts.rounds) {
					chat.sendMessage( `Seuraava kierros alkaa ${ opts.delay } sekunnin kuluttua.`, { parse_mode: 'HTML'} );
					setTimeout(() => {
						iterateRound( round+1, callback );
					}, opts.delay * 1000 );
				} else {
					callback();
				} 
			} else {
				callback(); 
			}
		});
	}

	function runRound( round, callback ) {

		const game = games[ chat.id ] = new GameAbstract( chat, opts );
		game.on( 'stop', function(){
			delete games[ this.chat.id ];
			callback( null, this );
		});

		var str = "Peli alkaa!";

		if (opts.rounds > 1) {
			str += `\nKierros *#${ round } / ${ opts.rounds }*`;
		} else if (opts.rounds == 1) {
			str += "\nPelataan yksi kierros";
		}

		if (isFinite( opts.timeout ) && opts.timeout > 0) str += `, kierros kestää *${ opts.timeout } sekuntia*`;
		chat.sendMessage( str + ".\n```\n" + game.toString() + "```", { parse_mode: "Markdown" });
	};

	/********************************/

	function parseOpts( opts ) {
		if (opts.size == null) opts.size = 5;
		else if (typeof opts.size != "number" || opts.size <= 0 || !isFinite(opts.size)) throw "Invalid argument opts.size";

		/**/

		if (opts.timeout == null) opts.timeout = Infinity;
		else if (typeof opts.timeout != "number" || opts.timeout <= 0 || !isFinite(opts.timeout)) throw "Invalid argument opts.timeout";

		/**/

		if (opts.chars == null) opts.chars  = "FIN"; 
		else if (typeof opts.chars != "string" || opts.chars.length == 0) throw "Invalid argument opts.chars";

		opts.chars = opts.chars.toUpperCase().replace( /[^\wÅÄÖ]/g, "");

		/**/

		if (opts.rounds == null) opts.rounds = 1;
		if (typeof opts.rounds != "number" || opts.rounds < 1 || !isFinite(opts.rounds)) throw "Invalid argument opts.rounds";

		/**/

		if (opts.delay == null) opts.delay = Infinity;
		else if (typeof opts.delay != "number" || opts.delay <= 0 || !isFinite(opts.delay)) throw "Invalid argument opts.delay";
	}
}








/*************************************/

/**
 * @param {number} [opts.size=5]           - Käytetyn laudan koko
 * @param {number} [opts.timeout=Infinity] - Kierroksen pituus
 * @param {string} [opts.chars=FIN]        - Käytetty kirjaimisto tai sen koodi
 */

/*function handleCmdPeli( msg, opts ) {
	console.debug( "handleCmdPeli( msg, opts ) ::", arguments );

	handleCmdPeli.parseOpts( opts );

	const chatId = msg.chat.id;

	if (games[ chatId ]) return sendMessage( chatId, `Peli on jo käynnissä, aloitettu ${ games[ chatId ].ctime.toLocaleString() }! Komenna /stop lopettaaksesi.` );
	
	if (isFinite( opts.timeout ) && opts.timeout > 0) {
		opts.timeoutFn = () => {
			delete games[ chatId ];
			sendMessage( chatId, `Aika loppui! Peli päättyi.` );
		};
		opts.timeoutFn.tMinus = {
			5: () => {
				sendMessage( chatId, `Aikaa jäljellä viisi sekuntia!` );
			}
		};
		sendMessage( chatId, `Ajastetaan peli päättymään ${ opts.timeout } sekunnin kuluttua`);
	}

	const game = games[ chatId ] = new GameAbstract( opts );

	sendMessage( chatId, `Peli aloitettu ${ game.ctime.toLocaleString() }!\n`+"```\n" + game.toString() + "```", { parse_mode: "Markdown" });

//	new Promise(( resolve, reject ) => {
//		try {
//			const canvas = require( "./StrArrToImage.js" )( game.board );
//			bot.sendPhoto( chatId, canvas.createPNGStream(), {}, { contentType: "image/png" }).then(resolve).catch(reject);
//		} catch( err ) { reject( err ); }
//	}).then( response => {
//		console.log("hereiam", response);
//	}).catch( err => {
//		console.error( err );
//		return sendMessage( chatId, "```\n" + game.toString() + "```", { parse_mode: "Markdown" });
//	}).then( response => {
//		console.log( "hereiam2", response );
//	});

}*/

/*handleCmdPeli.parseOpts = opts => {
	if (opts.size == null) opts.size = 5;
	else if (typeof opts.size != "number" || opts.size <= 0 || !isFinite(opts.size)) throw "Invalid argument opts.size";
	if (opts.size > 10) throw `Virheellinen asetus. Laudan sivun pituus voi olla korkeintaan 10 merkkiä (${ opts.size } > 10).`;


	if (opts.timeout == null) opts.timeout = Infinity;
	else if (typeof opts.timeout != "number" || opts.timeout <= 0 || !isFinite(opts.timeout)) throw "Invalid argument opts.timeout";


	if (opts.chars == null) opts.chars  = "FIN"; 
	else if (typeof opts.chars != "string" || opts.chars.length == 0) throw "Invalid argument opts.chars";

	opts.chars = opts.chars.toLowerCase().replace( /[^\wåäö]/g, "");
};*/


