
const TelegramBot = require('node-telegram-bot-api');

const argv  = require('minimist')(process.argv.slice(2));
const token = argv.token;

if (!token) throw "Missing parameter --token";


const bot = new TelegramBot( token, { polling: true });

const games = {};

class Game {
	constructor( cnf = {} ) {
		this.w = cnf.w || 4;
		this.h = cnf.h || 4;

		/** @TODO: selvitä oikean pelin merkit */
		this.charsArr = "abcdefghijklmnopqrstuvwxyzåäö".split("").map( v => [ v ]);

		this.ctime = new Date();


		this.charsArr.sort(() => Math.random()-.5 );
		this.board = [];
		for (var row, y = 0; y < this.h; y++) {
			this.board.push( row = [] );
			for (var x = 0; x < this.w; x++) {
				var idx = y * this.w + x;
				var chars = this.charsArr[ idx % this.charsArr.length ];
				row.push( chars[ parseInt( Math.random() * chars.length )]);
			}
		}
	}

	toString( opts = {} ) {
		return this.board.map( row => {
			return row.map( char => {
				return "" + char.toUpperCase() + "";
			}).join( "\t" );
		}).join( "\n" );
	}
}

bot.onText(/\/start(\s+\d+)?(\s+\d+)?(\s+\d+)?/, (msg, match) => {
	try {
		handleCmdStart( msg, match )
	} catch( err ) {
		console.error( "ERROR at bot.onText(\/start) ::", err );
	}
});

bot.onText(/\/stop/, (msg, match) => {
	try {
		handleCmdStop( msg, match )
	} catch( err ) {
		console.error( "ERROR at bot.onText(\/stop) ::", err );
	}
});

function handleCmdStart( msg, match ) {
	const chatId = msg.chat.id;

	if (games[ chatId ]) return bot.sendMessage( chatId, `Peli on jo käynnissä, aloitettu ${ games[ chatId ].ctime.toLocaleString() }! Komenna /stop lopettaaksesi.` );

	const cnf = {};

	if (match[2]) cnf.h = parseInt(match[2]); 
	if (match[3]) cnf.w = parseInt(match[3]);
	else if (match[2]) cnf.w = cnf.h;

	const game = games[ chatId ] = new Game( cnf );

	bot.sendMessage( chatId, `Peli aloitettu ${ game.ctime.toLocaleString() }!` );

	if (match[1]) {
		var timeout_s = parseInt( match[1] );

		game.$timeout = setTimeout(() => {
			delete games[ chatId ];
			bot.sendMessage( chatId, `Aika loppui! Peli päättyi.` );
		}, timeout_s * 1000 );
		game.$timeouts = [ game.$timeout ];

		
		if (timeout_s > 20) {
			game.$timeouts.push( setTimeout(() => {
				bot.sendMessage( chatId, `Aikaa jäljellä viisi sekuntia!` );
			}, (timeout_s - 5) * 1000 ));
		}

		bot.sendMessage( chatId, `Ajastettu päättymään ${ timeout_s } sekunnin kuluttua` );
	}

	bot.sendMessage( chatId, "```\n" + game.toString() + "```", { parse_mode: "Markdown" });
}

function handleCmdStop( msg, match ) {
	const chatId = msg.chat.id;
	const game = games[ chatId ];

	if (!game) return bot.sendMessage( chatId, "Ei peliä, joka lopettaa!" );

	if (game.$timeout) for (var timeout of game.$timeouts) clearTimeout( timeout );

	delete games[ chatId ];

	bot.sendMessage( chatId, "Peli lopetettu!" );
}
