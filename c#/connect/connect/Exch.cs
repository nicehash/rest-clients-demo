using NLog;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace connect
{
    class Exch
    {
        private static NLog.Logger Logger = NLog.LogManager.GetCurrentClassLogger();

        private static string CURRENCY_SELL = "TBTC"; //user BTC for production
        private static string CURRENCY_BUY  = "TLTC"; //use LTC for production

        public Exch()
        {
            var config = new NLog.Config.LoggingConfiguration();
            var logconsole = new NLog.Targets.ConsoleTarget("logconsole");
            config.AddRule(LogLevel.Info, LogLevel.Fatal, logconsole);
            NLog.LogManager.Configuration = config;

            Api api = new Api();

            //get server time
            string timeResponse = api.get("/api/v2/time");
            ServerTime serverTimeObject = Newtonsoft.Json.JsonConvert.DeserializeObject<ServerTime>(timeResponse);
            string time = serverTimeObject.serverTime;
            Logger.Info("server time: {}", time);

            //get algo settings
            string exchResponse = api.get("/exchange/api/v2/info/status");
            Symbols symbolsObj = Newtonsoft.Json.JsonConvert.DeserializeObject<Symbols>(exchResponse);

            String mySettings = null;
            foreach (Symbol s in symbolsObj.symbols)
            {
                if (s.baseAsset.Equals(CURRENCY_BUY))
                {
                    mySettings = s.baseAsset;
                }
            }
            Logger.Info("exchange settings: {}", mySettings);

            //get balance
            string accountsResponse = api.get("/main/api/v2/accounting/accounts2", true, time);
            Currencies currenciesObj = Newtonsoft.Json.JsonConvert.DeserializeObject<Currencies>(accountsResponse);
            double myBalace = 0;
            foreach (Currency c in currenciesObj.currencies)
            {
                if (c.currency.Equals(CURRENCY_SELL))
                {
                    myBalace = c.available;
                }
            }
            Logger.Info("balance: {} {}", myBalace, CURRENCY_SELL);

            //get order book
            string orderBookResponse = api.get("/exchange/api/v2/orderbook?market=" + CURRENCY_BUY + CURRENCY_SELL + "&limit=100", true, time);
            OrderBooks orderBooks = Newtonsoft.Json.JsonConvert.DeserializeObject<OrderBooks>(orderBookResponse);
            Logger.Info("cheapest offer price: {} supply: {}", orderBooks.sell[0][0], orderBooks.sell[0][1]);

            double qty = 0.1 * 2;
            string sQty = qty.ToString("0.00000000", System.Globalization.CultureInfo.InvariantCulture);
            string sPrice = orderBooks.sell[0][0].ToString("0.00000000", System.Globalization.CultureInfo.InvariantCulture);

            //buy with limit order
            string url = "/exchange/api/v2/order?market=" + CURRENCY_BUY + CURRENCY_SELL + "&side=buy&type=limit&quantity=" + sQty + "&price=" + sPrice;
            Logger.Info("order url: {}", url);
            string orderCreateResponse = api.post(url, null, time, true);
            Logger.Info("order create: {}", orderCreateResponse);
        }
    }

}
