import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Spot } from '@binance/connector';
import sendEmail from '@dfyu/mailer';

const { BINANCE_KEY, BINANCE_SECURE } = process.env;
const client = new Spot(BINANCE_KEY, BINANCE_SECURE);

async function getTicker(windowSize) {
  const response = await client.rollingWindowTicker(
    '',
    ['BTCUSDT', 'ETHUSDT'],
    {
      windowSize,
    },
  );
  const ETH = response.data.find((item) => item.symbol === 'ETHUSDT');
  const BTC = response.data.find((item) => item.symbol === 'BTCUSDT');

  return {
    ETH,
    BTC,
  };
}

function pricePercent(item) {
  return item.priceChangePercent.startsWith('-')
    ? `⬇️${+(+item.priceChangePercent.slice(1)).toFixed(2)}%️`
    : `⬆️${+(+item.priceChangePercent).toFixed(2)}%`;
}
@Injectable()
export default class Service {
  constructor() {
    this.getEveryHourTicker();
  }

  // 每小时固定推送
  @Cron(CronExpression.EVERY_HOUR)
  async getEveryHourTicker() {
    const { ETH, BTC } = await getTicker('1h');

    sendEmail({
      to: 'richoleyu@126.com',
      subject: '一小时币圈快报',
      html: [
        `<p>ETH: ${~~ETH.lastPrice}, ${pricePercent(ETH)}</p>`,
        `<p>BTC: ${~~BTC.lastPrice}, ${pricePercent(BTC)}</p>`,
      ].join(''),
    });
  }

  // 15分钟内涨跌幅超1%
  @Cron(CronExpression.EVERY_MINUTE)
  async getShortTicker() {
    const { ETH, BTC } = await getTicker('15m');
    const ethPrice = +ETH.priceChangePercent;
    const btcPrice = +BTC.priceChangePercent;

    if (ethPrice > 1.0 || ethPrice < 1.0 || btcPrice > 1.0 || btcPrice < 1.0) {
      sendEmail({
        to: 'richoleyu@126.com',
        subject: '过去15分钟涨跌幅超1%',
        html: [
          `<p>ETH: ${~~ETH.lastPrice}, ${pricePercent(ETH)}</p>`,
          `<p>BTC: ${~~BTC.lastPrice}, ${pricePercent(BTC)}</p>`,
        ].join(''),
      });
    }
  }
}
