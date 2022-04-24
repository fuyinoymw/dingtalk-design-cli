import CommandWrapper from '../../scheduler/command/commandWrapper';
import qrcode from '../../actions/qrcode';
import { EAppType, ECommandName, } from '../../lib/common/types';
import commmandsConfig from '../commandsConfig';
import config from '../../lib/common/config';

export interface ICommandOptions {
  miniAppId?: string;
  token?: string;
  debug?: boolean;
  page?: string;
  query?: string;
}

export default CommandWrapper<ICommandOptions>({
  name: ECommandName.preview,
  registerCommand(ctx) {
    return {
      ...commmandsConfig.preview,
      action: async (options) => {
        const {
          dtdConfig,
          cwd,
        } = ctx;

        if (!dtdConfig.type) {
          ctx.logger.error(`当前目录 ${cwd} 下没有找到 ${config.workspaceRcName} 文件，请先使用init初始化项目；或者也可以选择手动新增 ${config.workspaceRcName} 配置文件，参考文档 https://developers.dingtalk.com/document/resourcedownload/configuration-description?pnamespace=app`);
          return;
        }

        if ([EAppType.MP, EAppType.PLUGIN].indexOf(dtdConfig.type as EAppType) === -1) {
          ctx.logger.error(`${ECommandName.preview} 命令只支持小程序或工作台组件`);
          return;
        }

        qrcode(ctx, options);
      },
    };
  },
});