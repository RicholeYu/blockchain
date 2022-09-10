import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Spot } from '@binance/connector';
import sendEmail from '@dfyu/mailer';

const { BINANCE_KEY, BINANCE_SECRET } = process.env;
const client = new Spot(BINANCE_KEY, BINANCE_SECRET);

interface TickerOptions {
  openTime?: number;
  closeTime?: number;
}

async function getTicker(coin = '', windowSize, options: TickerOptions = {}) {
  const coins = `${coin}USDT`;
  const response = await client.rollingWindowTicker('', [coins], {
    ...(windowSize ? { windowSize } : {}),
    ...options,
  });

  const item = response.data.find((item) => item.symbol === coins);

  return item;
}

function pricePercent(item) {
  return item.priceChangePercent.startsWith('-')
    ? `下跌${+(+item.priceChangePercent.slice(1)).toFixed(2)}%️`
    : `上涨${+(+item.priceChangePercent).toFixed(2)}%`;
}

const sendEmailBySubject = (subject, item) =>
  sendEmail({
    to: 'richoleyu@126.com',
    subject,
    html: [`<p>最新价格: ${~~item.lastPrice}, ${pricePercent(item)}</p>`].join(
      '',
    ),
  });

export default function (coin: string): any {
  @Injectable()
  class Service {
    continueLongTimes = 0;
    continueShortTimes = 0;
    last15MinPrice = 0;
    constructor() {
      this.getEveryHourTicker();
    }

    // 每小时固定推送
    @Cron(CronExpression.EVERY_HOUR)
    async getEveryHourTicker() {
      const item = await getTicker(coin, '1h');

      sendEmailBySubject(`一小时快报(${coin})`, item);
    }

    // 15分钟内涨跌幅超1%
    @Cron(CronExpression.EVERY_MINUTE)
    async getShortTicker() {
      const item = await getTicker(coin, '15m');
      const price = +item.priceChangePercent;

      if (price > 1.0 || price < -1.0) {
        sendEmailBySubject(`过去15分钟涨跌幅超1%(${coin})`, item);
      }
    }

    // 15分钟时间段连续涨跌幅
    @Cron('0 */15 * * * *')
    async getContinue15MinTicker() {
      const item = await getTicker(coin, '15m');
      const price = +item.priceChangePercent;

      if (price > 0) {
        this.continueShortTimes = 0;
        this.continueLongTimes++;

        if (this.continueLongTimes >= 3) {
          sendEmailBySubject(
            `15分钟时间段已连续涨幅超过${this.continueLongTimes}次(${coin})`,
            item,
          );
        }
      }

      if (price < 0) {
        this.continueLongTimes = 0;
        this.continueShortTimes++;

        if (this.continueShortTimes >= 3) {
          sendEmailBySubject(
            `15分钟时间段已连续跌幅超过${this.continueShortTimes}次(${coin})`,
            item,
          );
        }
      }
    }

    // 插针或连续行情
    @Cron('0 */15 * * * *')
    async getImportantTicker() {
      const item = await getTicker(coin, '15m');
      const price = +item.priceChangePercent;

      if (price > 1) {
        if (this.last15MinPrice > 1) {
          sendEmailBySubject(`15分钟时间段已出现连续大波动上涨行情`, item);
        }

        if (this.last15MinPrice < -1) {
          sendEmailBySubject(`15分钟时间段出现下跌插针行情`, item);
        }
      }

      if (price < -1) {
        if (this.last15MinPrice < -1) {
          sendEmailBySubject(`15分钟时间段已出现连续大波动下跌行情`, item);
        }

        if (this.last15MinPrice > 1) {
          sendEmailBySubject(`15分钟时间段出现上涨插针行情`, item);
        }
      }

      this.last15MinPrice = price;
    }
  }

  return Service;
}
