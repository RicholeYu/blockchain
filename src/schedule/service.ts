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

interface Ticker {
  priceChangePercent: string;
  lastPrice: string;
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

const sendEmailBySubject = (subject, item: string | Ticker) => {
  if (typeof item === 'string') {
    sendEmail({
      to: 'richoleyu@126.com',
      subject,
      content: item,
    });
  } else {
    sendEmail({
      to: 'richoleyu@126.com',
      subject,
      html: [
        `<p>最新价格: ${~~item.lastPrice}, ${pricePercent(item)}</p>`,
      ].join(''),
    });
  }
};

function formatTime(time) {
  const nums = time.split('');
  const unit = {
    m: '分钟',
    h: '小时',
    d: '天',
  }[nums.pop()];
  return nums.join('') + unit;
}

export default function (coin: string): any {
  @Injectable()
  class Service {
    lastPrice = {};
    continueShortTimes = {};
    continueLongTimes = {};
    continueShortArr = {};
    continueLongArr = {};

    // 五分钟定时器
    @Cron(CronExpression.EVERY_5_MINUTES)
    async every5MinTask() {
      // 过去5分钟交易量增幅
      this.getShortTicker('5m');
      // 每五分钟连续大波动或插针
      this.getImportantTicker('5m');
      // 每五分钟连续涨跌幅
      this.getContinueTicker('5m');
    }

    // 15分钟定时器
    @Cron('0 */15 * * * *')
    async every15MinTask() {
      // 过去5分钟交易量增幅
      this.getShortTicker('15m');
      // 15分钟连续大波动或插针
      this.getImportantTicker('15m');
      // 15分钟时间段连续涨跌幅
      this.getContinueTicker('15m');
    }

    // 每小时定时器
    @Cron(CronExpression.EVERY_HOUR)
    async getEveryHourTicker() {
      // 每小时交易量增幅
      this.getShortTicker('1h');
      // 每小时连续大波动或插针
      this.getImportantTicker('1h');
      // 每小时段连续涨跌幅
      this.getContinueTicker('1h');

      const item = await getTicker(coin, '1h');
      sendEmailBySubject(`一小时快报(${coin})`, item);
    }

    // 交易量增幅
    async getShortTicker(time) {
      const item = await getTicker(coin, time);

      if (this.lastPrice[time]) {
        const precent =
          (item.quoteVolume / this.lastPrice[time].quoteVolume - 1) * 100;
        if (precent > 100) {
          sendEmailBySubject(
            `过去${formatTime(time)}交易量大增${precent.toFixed(1)}%(${coin})`,
            item,
          );
        }
      }

      this.lastPrice[time] = item;
    }

    async getContinueTicker(time) {
      const item = await getTicker(coin, time);
      const price = +item.priceChangePercent;

      if (price > 0) {
        this.continueShortTimes[time] = 0;
        this.continueShortArr[time] = [];
        this.continueLongTimes[time] = this.continueLongTimes[time] || 0;
        this.continueLongArr[time] = this.continueLongArr[time] || [];
        this.continueLongTimes[time]++;
        this.continueLongArr[time].push(item);

        if (this.continueLongTimes[time] >= 3) {
          const total = this.continueLongArr[time].reduce(
            (total, current) => total + +current.priceChangePercent,
            0,
          );
          sendEmailBySubject(
            `15分钟时间段已连续上涨超过${this.continueLongTimes[time]}次(${coin})`,
            `从${~~this.continueLongArr[time][0]
              .lastPrice}上涨到${~~item.lastPrice}, 共计上涨${total.toFixed(
              2,
            )}%`,
          );
        }
      }

      if (price < 0) {
        this.continueLongTimes[time] = 0;
        this.continueLongArr[time] = [];
        this.continueShortTimes[time] = this.continueShortTimes[time] || 0;
        this.continueShortArr[time] = this.continueShortArr[time] || [];
        this.continueShortTimes[time]++;
        this.continueShortArr[time].push(item);

        if (this.continueShortTimes[time] >= 3) {
          const total = this.continueShortArr[time].reduce(
            (total, current) => total + +current.priceChangePercents.slice(1),
            0,
          );
          sendEmailBySubject(
            `15分钟时间段已连续下跌超过${this.continueShortTimes[time]}次(${coin})`,
            `从${~~this.continueShortArr[time][0]
              .lastPrice}下跌到${~~item.lastPrice}, 共计下跌${total.toFixed(
              2,
            )}%`,
          );
        }
      }
    }

    async getImportantTicker(time) {
      const item = await getTicker(coin, time);
      const price = +item.priceChangePercent;
      const lastPrice = this.lastPrice[time];

      if (price > 1) {
        if (lastPrice && +lastPrice.priceChangePercent > 1) {
          sendEmailBySubject(
            `${formatTime(time)}时间段已出现连续大波动上涨行情(${coin})`,
            item,
          );
        }

        if (lastPrice && +lastPrice.priceChangePercent < 1) {
          sendEmailBySubject(
            `${formatTime(time)}时间段出现下跌插针行情${coin}`,
            item,
          );
        }
      }

      if (price < -1) {
        if (lastPrice && +lastPrice.priceChangePercent < -1) {
          sendEmailBySubject(
            `${formatTime(time)}时间段已出现连续大波动下跌行情(${coin})`,
            item,
          );
        }

        if (lastPrice && +lastPrice.priceChangePercent > 1) {
          sendEmailBySubject(
            `${formatTime(time)}时间段出现上涨插针行情${coin}`,
            item,
          );
        }
      }

      this.lastPrice[time] = price;
    }
  }

  return Service;
}
