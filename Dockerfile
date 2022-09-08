FROM node
COPY ./ /wechat
WORKDIR /wechat
RUN npm i npm -g
RUN npm i
RUN npm run build
CMD ["npm", "run", "start:prod"]