import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export default class Service {
  @Cron(CronExpression.EVERY_10_SECONDS)
  getHello(): string {
    console.log('Hello Richole');
    return 'Hello World!';
  }
}
