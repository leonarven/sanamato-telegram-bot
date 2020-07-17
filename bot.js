const        TelegramBot = require( 'node-telegram-bot-api' );
const OfflineTelegramBot = require( './OfflineTelegramBot' );

const { GameAbstract } = require( './game.js' );

const Chat = OfflineTelegramBot.Chat;
const chats = {};
const games = {};

const argv  = require('minimist')(process.argv.slice(2));
const token = argv.token;

if (!token) throw "Missing parameter --token";

const bot = new (require( argv.offline ? './OfflineTelegramBot' : 'node-telegram-bot-api' ))( token, { polling: true });


bot.on('polling_error', err => {
	console.error( "ERROR at bot.on(polling_error) ::", err );

	if (err.code == "EFATAL") {
		console.error( "Got EFATAL error. Exiting" );
		process.exit();
	}
});

bot.on('text', msg => {
	const chatId = msg.chat && msg.chat.id || null;

	if (chatId) {
		if (!chats[ chatId ]) chats[ chatId ] = new Chat( chatId, msg.chat );

		const game = games[ chatId ];
		if (game) {
			console.debug( "bot.on('text', (msg)) ::", msg );

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
bot.onText(/^\/peli(?:\s+(\d+)(?:\s+(\d+)(?:\s+(.+))?)?)?\s*$/, (msg, match) => {
	console.debug( "bot.onText(\/start, ( msg, match )) :: ", msg, match );

	try {
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
bot.onText(/^\/kisa(?:\s+(\d+)(?:\s+(\d+)(?:\s+(\d+)(?:\s+(\d+)(?:\s+(.+))?)?)?)?)?\s*$/, (msg, match) => {
	console.debug( "bot.onText(\/kisa, ( msg, match )) :: ", msg, match );
	try {
		handleCmdKisa( msg, {
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



/**
 */
bot.onText(/\/stop/, (msg, match) => {
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

		if (!game) return sendMessage( chatId, "Ei peliä, joka lopettaa!", { disable_notification: true } );

		for (var timeout of game.$timeouts) clearTimeout( timeout );

		delete games[ chatId ];

		sendMessage( chatId, "Peli keskeytetty!", { disable_notification: true } );
	}
});




function sendMessage( chatId ) {
	console.debug( "sendMessage() ::", arguments );

	if (chatId == null) {
		return Promise.resolve( console.log( "sendMessage() :: Message not sended, no chatId" ));
	} else {
		return bot.sendMessage.apply( bot, arguments );
	}
}

/*************************************/

/**
 * @param {number} [opts.size=5]           - Käytetyn laudan koko
 * @param {number} [opts.timeout=Infinity] - Kierroksen pituus
 * @param {string} [opts.chars=FIN]        - Käytetty kirjaimisto tai sen koodi
 */

function handleCmdPeli( msg, opts ) {
	console.debug( "handleCmdPeli( msg, opts ) ::", arguments );

	handleCmdPeli.parseOpts( opts );

	const chatId = msg.chat.id;

	if (games[ chatId ]) return sendMessage( chatId, `Peli on jo käynnissä, aloitettu ${ games[ chatId ].ctime.toLocaleString() }! Komenna /stop lopettaaksesi.`, { disable_notification: true } );
	
	if (isFinite( opts.timeout ) && opts.timeout > 0) {
		opts.timeoutFn = () => {
			delete games[ chatId ];
			sendMessage( chatId, `Aika loppui! Peli päättyi.`, { disable_notification: true } );
		};
		opts.timeoutFn.tMinus = {
			5: () => {
				sendMessage( chatId, `Aikaa jäljellä viisi sekuntia!`, { disable_notification: true } );
			}
		};
		sendMessage( chatId, `Ajastetaan peli päättymään ${ opts.timeout } sekunnin kuluttua`, { disable_notification: true } );
	}

	const game = games[ chatId ] = new GameAbstract( opts );

	sendMessage( chatId, `Peli aloitettu ${ game.ctime.toLocaleString() }!\n`+"```\n" + game.toString() + "```", { parse_mode: "Markdown", disable_notification: true });

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

}

handleCmdPeli.parseOpts = opts => {
	if (opts.size == null) opts.size = 5;
	else if (typeof opts.size != "number" || opts.size <= 0 || !isFinite(opts.size)) throw "Invalid argument opts.size";


	if (opts.timeout == null) opts.timeout = Infinity;
	else if (typeof opts.timeout != "number" || opts.timeout <= 0 || !isFinite(opts.timeout)) throw "Invalid argument opts.timeout";


	if (opts.chars == null) opts.chars  = "FIN"; 
	else if (typeof opts.chars != "string" || opts.chars.length == 0) throw "Invalid argument opts.chars";

	opts.chars = opts.chars.toLowerCase().replace( /[^\wåäö]/g, "");
};

/************************************************/

/**
 * @param {number} [opts.size=5]           - Käytetyn laudan koko
 * @param {number} [opts.timeout=Infinity] - Kierroksen pituus
 * @param {number} [opts.rounds=1]         - Kierrosten lukumäärä
 * @param {number} [opts.delay=Infinity]   - Kierrosten välinen aika
 * @param {string} [opts.chars=FIN]        - Käytetty kirjaimisto tai sen koodi
 */
function handleCmdKisa( msg, opts ) {
	console.debug( "handleCmdKisa( msg, opts ) ::", arguments );

	const chatId = msg.chat.id;
	
	if (games[ chatId ]) return sendMessage( chatId, `Peli on jo käynnissä, aloitettu ${ games[ chatId ].ctime.toLocaleString() }! Komenna /stop lopettaaksesi.`, { disable_notification: true } );

	handleCmdKisa.parseOpts( opts );
	
	if (opts.timeout == null || !isFinite(opts.timeout)) throw "Not implemented yet! (opts.timeout unsetted)"; 


	iterateRound();

	function iterateRound() {
		if (isFinite( opts.timeout ) && opts.timeout > 0) {
			opts.timeoutFn = () => {
				var game   = games[ chatId ];
				var scores = game.getScores();

				console.log( "Scores:", scores );
				delete games[ chatId ];

				sendMessage( chatId, `Aika loppui! Peli päättyi.`, { disable_notification: true } );

				var score_txt = "";
				for (var id in scores) {
					var score = scores[id];
					score_txt += `\n\n${ game.players[id].label }, `;
					
					if (Object.keys( scores ).length == 1) {
						score_txt += `${ score.words.length } sanaa.`;
					} else {
						if (score.words.length == score.uniques.length) {
							score_txt += `${ score.words.length } sanaa, kaikki uniikkeja.`;
						} else {
							score_txt += `${ score.words.length } sanaa, ${ score.uniques.length } uniikkia.`;
						}
					}

					for (var word in score.founds) {
						var paths = score.founds[word];
						for (var path of paths) {
							score_txt += `\n${word} - ${ path }`;
						}
					}
				}

				sendMessage( chatId, "Tulokset:" + score_txt, { disable_notification: true } );
			};
			opts.timeoutFn.tMinus = {
				5: () => {
					sendMessage( chatId, `Aikaa jäljellä viisi sekuntia!`, { disable_notification: true } );
				}
			};
			sendMessage( chatId, `Ajastetaan peli päättymään ${ opts.timeout } sekunnin kuluttua`, { disable_notification: true } );
		}

		const game = games[ chatId ] = new GameAbstract( opts );

		sendMessage( chatId, `Peli aloitettu ${ game.ctime.toLocaleString() }!\n`+"```\n" + game.toString() + "```", { parse_mode: "Markdown", disable_notification: true });
	};
}
handleCmdKisa.parseOpts = opts => {
	handleCmdPeli.parseOpts( opts );

	if (opts.rounds == null) opts.rounds = 1;
	if (typeof opts.rounds != "number" || opts.rounds < 1 || !isFinite(opts.rounds)) throw "Invalid argument opts.rounds";


	if (opts.delay == null) opts.delay = Infinity;
	else if (typeof opts.delay != "number" || opts.delay <= 0 || !isFinite(opts.delay)) throw "Invalid argument opts.delay";
}
