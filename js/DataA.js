var dataGiornata = new Array()
// Immettere le date nel formato inglese: Mese Giorno Anno
// Gennaio = January
// Febbraio = February
// Marzo = March
// Aprile = April
// Maggio = May
// Giugno = June
// Luglio = July
// Agosto = August
// Settembre = September
// Ottobre = October
// Novembre = November
// Dicembre = December
dataGiornata[1] = "August 22 2026 18:30"
dataGiornata[2] = "August 28 2026 20:45"
dataGiornata[3] = "September 4 2026 20:45"
dataGiornata[4] = "September 11 2026 20:45"
dataGiornata[5] = "September 18 2026 20:45"
dataGiornata[6] = "October 10 2026 15:00"
dataGiornata[7] = "October 16 2026 20:45"
dataGiornata[8] = "October 23 2026 20:45"
dataGiornata[9] = "October 27 2026 18:30"
dataGiornata[10] = "October 31 2026 15:00"
dataGiornata[11] = "November 6 2026 20:45"
dataGiornata[12] = "November 21 2026 15:00"
dataGiornata[13] = "November 27 2026 20:45"
dataGiornata[14] = "December 4 2026 20:45"
dataGiornata[15] = "December 11 2026 20:45"
dataGiornata[16] = "December 18 2026 18:30"
dataGiornata[17] = "January 2 2027 12:30"
dataGiornata[18] = "January 5 2027 18:30"
dataGiornata[19] = "January 9 2027 15:00"
dataGiornata[20] = "January 15 2027 20:45"
dataGiornata[21] = "January 22 2027 20:45"
dataGiornata[22] = "January 29 2027 20:45"
dataGiornata[23] = "February 5 2027 20:45"
dataGiornata[24] = "February 12 2027 20:45"
dataGiornata[25] = "February 19 2027 20:45"
dataGiornata[26] = "February 26 2027 20:45"
dataGiornata[27] = "March 5 2027 20:45"
dataGiornata[28] = "March 12 2027 20:45"
dataGiornata[29] = "March 19 2027 20:45"
dataGiornata[30] = "April 2 2027 20:45"
dataGiornata[31] = "April 9 2027 20:45"
dataGiornata[32] = "April 16 2027 20:45"
dataGiornata[33] = "April 23 2027 20:45"
dataGiornata[34] = "April 30 2027 20:45"
dataGiornata[35] = "May 7 2027 20:45"
dataGiornata[36] = "May 14 2027 20:45"
dataGiornata[37] = "May 21 2027 20:45"
dataGiornata[38] = "May 28 2027 20:45"

function initArray() {  
   this.length = initArray.arguments.length
    for (var i = 0; i < this.length; i++)
    this[i+1] = initArray.arguments[i]
}
var DOWArray = new initArray("Dom","Lun","Mar","Mer","Gio","Ven","Sab")
var MOYArray = new initArray("Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic")
var Year,Ore,Minuti

for (t = 1; t < dataGiornata.length ;t++ ) {
   data = new Date(dataGiornata[t])
   Year = data.getFullYear()
   if(data.getHours()<=9?Ore="0"+data.getHours():Ore=data.getHours())
   if(data.getMinutes()<=9?Minuti="0"+data.getMinutes():Minuti=data.getMinutes())
   dataGiornata[t] = DOWArray[(data.getDay()+1)] + " " + data.getDate() + " " + MOYArray[(data.getMonth()+1)] + " " + Year + " ore " + Ore +":" + Minuti
}