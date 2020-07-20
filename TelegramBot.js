class OfflineTelegramBot {
	constructor( token, config ) {}
	on() {}
	onText() {}
}
class TelegramBot extends (require( 'node-telegram-bot-api' )) {
	constructor( token, config ){
		super( token, config );

		this.commands = {};

		this.addCommand( "help", null, ( msg ) => {
			msg.chat.sendMessage( Object.keys( this.commands ).map( cmd => {
				var obj = this.commands[ cmd ];
				return `/${ obj.cmd } - ${ obj.description || obj.regexp }`;
			}).join( "\n\n" ), { parse_mode: "Markdown" });
		}, "Näytä ohjelistaus" );
	}

	addCommand( cmd, regexp, callbackFn, description = "" ){
		if (typeof this.commands[ cmd ] == "object") return console.warn( `Unable to overwrite command /${ cmd }` );
		
		regexp = regexp || new RegExp( `^/${ cmd }$` );

		console.log( `TelegramBot.addCommand( cmd, regexp ) :: /${ cmd }`, regexp );

		this.commands[ cmd ] = { cmd, regexp, callbackFn, description };
		
		this.onText( regexp, ( msg, match ) => {
			console.log( `bot.onText(\/${ cmd }, ( msg, match )) :: `, msg, match );

			return new Promise(( resolve, reject ) => {
				try {
					Promise.resolve( callbackFn( msg, match )).then( resolve ).catch( reject );
				} catch( err ) {
					reject( err );
				}
			}).catch( err => {
				console.error( `ERROR @ bot.onText(\/${ cmd }) ::`, err );
				throw err;
			});
		});
	}
}

const chats = {};
class Chat {
	constructor( chat = {} ) {
		for (var id in chat) this[id] = chat[id];

		Object.defineProperty( this, 'title', {
			get: () => {
				switch (this.type) {
					case "private": return this.username;
				}
				return this.id;
			}
		});
		
		Object.defineProperty( this, 'users', { value: {} });

		console.debug( "new Chat() ::", this );
	}

	static get( chat = {} ){
		if (typeof chat == "string" || typeof chat == "number") return chats[ chat ];

		if (typeof chat != "object" || !chat.id) return null;

		return (chats[ chat.id ] = chats[ chat.id ] || new Chat( chat ));
	}
}


var __messageSendTimeout = null;
class MessageSender {
	constructor( bot ) {
		var self = this;

		this.bot = bot;

		Object.defineProperty( this, "__messages", { value: [] });
		this.__messages.push = message => {
			var ret = Array.prototype.push.call( this.__messages, message );
			setTimeout(() => this.__sendMessageRefresh() );
			return ret;
		};
	}

	sendMessage( chatId, message, opts = {} ) {
		if (typeof opts.disable_notification == "undefined") opts.disable_notification = true; 

		if (typeof chatId == "object" && typeof chatId.id != "undefined") chatId = chatId.id;

		if (chatId == null) {
			return Promise.resolve( console.log( "sendMessage() :: Message not sended, no chatId" ));
		}

		if (!Array.isArray( message )) message = [ message ];
		
		return message.forEach(( msg, i ) => this.__messages.push([ chatId, msg, opts ]));
	}

	__sendMessageRefresh() {
		if (!__messageSendTimeout && this.__messages.length > 0) {
			__messageSendTimeout = setTimeout( message => {
				__messageSendTimeout = null;
				
				if (!message) return;

				console.log( "sendMessage( chatId, msg, opts ) ::", message );
			
				this.bot.sendMessage.apply( this.bot, message ).catch( err => {
					console.error( "ERROR@__sendMessageRefresh()-cycle :: bot.sendMessage got rejected:", err, "message:", message );
				}).finally(() => this.__sendMessageRefresh() );
			}, 250, this.__messages.splice( 0, 1 )[0]);
		} 
	}
}


module.exports = { TelegramBot, OfflineTelegramBot, MessageSender, Chat };
