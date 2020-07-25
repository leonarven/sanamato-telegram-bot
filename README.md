# sanamato-telegram-bot
(Alunperin) puolen tunnin telegram-botti-implementaatio pelistä, jossa arvotaan ruudukollinen kirjaimia ja näiden pohjalta voi pelaaja muodostaa sanoja.


## Käyttö

0. [**Luo Telegram-botti**](https://core.telegram.org/bots#3-how-do-i-create-a-bot) tätä tarkoitusta varten
1. **Kloonaa** tämä repository
1. **Käynnistä** `node bot.js --token=<@BotFather:n antama API-token>`
1. Aloita yksityiskeskustelu / kutsu bottisi keskusteluryhmään
	1. Botti pitää asettaa ryhmän ylläpitäjäksi, jotta se voi lukea käyttäjien /kisa'ssa antamia vastauksia.

## Komennot

`/stop` - Lopeta nykyinen peli.

`/peli <koko=5> <aika=120> <kirjaimisto=FIN>` - Aloita yhden kierroksen peruspeli.

`/kisa <koko=5> <aika=120> <kierroksia=1> <kierrosten väli> <kirjaimisto=FIN>` - Aloita kilpailu.

### Vähemmän tärkeitä komentoja 

`/help` - Näytä ohjelistaus.

`/die` - Sammuta botti (Vaatii käyttäjän ID:n määritellyn: `node bot.js --admins=ID1,ID2 ...`)

`/echo <viesti>` - Toistaa viestin `viesti` :D

# TODO

 * Sanojen oikeellisuuden tarkistaminen esiasetetun tietokannan perusteella ([YSO?](https://finto.fi/yso/fi/))
 * Tilastot peleistä tietokantaan
 * Pelin/kisan oletusasetusten määrääminen
 * Paremmat ohjeet & interaktiivisuutta
 * Tietoisuus ja lisääntyminen
