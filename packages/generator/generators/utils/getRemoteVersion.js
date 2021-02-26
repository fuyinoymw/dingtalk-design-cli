"use strict";
var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    function adopt(value) {return value instanceof P ? value : new P(function (resolve) {resolve(value);});}
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) {try {step(generator.next(value));} catch (e) {reject(e);}}
        function rejected(value) {try {step(generator["throw"](value));} catch (e) {reject(e);}}
        function step(result) {result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);}
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable */
const execa = require("execa");
const path = require("path");
const os = require("os");
const fs = require("fs");
const ini = require("ini");
const cli_shared_utils_1 = require("./cli-shared-utils");
const logger_1 = require("./logger");
const errors_1 = require("../common/errors");
const request_1 = require("./request");
const semver = require("semver");
// extract the package scope from the full package name
// the result includes the initial @ character
function extractPackageScope(packageName) {
    const scopedNameRegExp = /^(@[^\/]+)\/.*$/;
    const result = scopedNameRegExp.exec(packageName);
    if (!result) {
        return undefined;
    }
    return result[1];
}
function getBin() {
    let bin = '';
    if (cli_shared_utils_1.hasYarn()) {
        bin = 'yarn';
    } else
    if (cli_shared_utils_1.hasPnpm()) {
        bin = 'pnpm';
    } else
    if (cli_shared_utils_1.hasNpm()) {
        bin = 'npm';
    }
    return bin;
}
function getRegistry(scope) {
    return __awaiter(this, void 0, void 0, function* () {
        const bin = getBin();
        if (!bin) {
            logger_1.error(errors_1.ERROR_PM_NOT_FOUND);
            throw errors_1.ERROR_PM_NOT_FOUND;
        }
        let registry;
        try {
            if (scope) {
                registry = (yield execa(bin, ['config', 'get', scope + ':registry'])).stdout;
            }
            if (!registry || registry === 'undefined') {
                registry = (yield execa(bin, ['config', 'get', 'registry'])).stdout;
            }
        }
        catch (e) {
            // Yarn 2 uses `npmRegistryServer` instead of `registry`
            registry = (yield execa(bin, ['config', 'get', 'npmRegistryServer'])).stdout;
        }
        logger_1.debug(`getRegistry: ${registry}`);
        return registry;
    });
}
function getAuthToken(scope) {
    return __awaiter(this, void 0, void 0, function* () {
        // get npmrc (https://docs.npmjs.com/configuring-npm/npmrc.html#files)
        const possibleRcPaths = [
        path.resolve(process.cwd(), '.npmrc'),
        path.resolve(os.homedir(), '.npmrc')];

        if (process.env.PREFIX) {
            possibleRcPaths.push(path.resolve(process.env.PREFIX, '/etc/npmrc'));
        }
        // there's also a '/path/to/npm/npmrc', skipped for simplicity of implementation
        let npmConfig = {};
        for (const loc of possibleRcPaths) {
            if (fs.existsSync(loc)) {
                try {
                    // the closer config file (the one with lower index) takes higher precedence
                    npmConfig = Object.assign({}, ini.parse(fs.readFileSync(loc, 'utf-8')), npmConfig);
                }
                catch (e) {
                    // in case of file permission issues, etc.
                }
            }
        }
        const registry = yield getRegistry(scope);
        const registryWithoutProtocol = registry.
        replace(/https?:/, '') // remove leading protocol
        .replace(/([^/])$/, '$1/'); // ensure ending with slash
        const authTokenKey = `${registryWithoutProtocol}:_authToken`;
        return npmConfig[authTokenKey];
    });
}
// https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md
function getMetadata(packageName, { full = false } = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const scope = extractPackageScope(packageName);
        const registry = yield getRegistry(scope);
        let metadata;
        const headers = {};
        if (!full) {
            headers.Accept = 'application/vnd.npm.install-v1+json;q=1.0, application/json;q=0.9, */*;q=0.8';
        }
        const authToken = yield getAuthToken(scope);
        if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
        }
        const url = `${registry.replace(/\/$/g, '')}/${packageName}`;
        try {
            const res = yield request_1.default.get(url, { headers });
            metadata = res.body;
            if (metadata.error) {
                throw new Error(metadata.error);
            }
            return metadata;
        }
        catch (e) {
            logger_1.error(`Failed to get response from ${url}`);
            throw e;
        }
    });
}
function getRemoteVersion(packageName, versionRange = 'latest') {
    return __awaiter(this, void 0, void 0, function* () {
        const metadata = yield getMetadata(packageName);
        if (Object.keys(metadata['dist-tags']).includes(versionRange)) {
            return metadata['dist-tags'][versionRange];
        }
        const versions = Array.isArray(metadata.versions) ? metadata.versions : Object.keys(metadata.versions);
        return semver.maxSatisfying(versions, versionRange);
    });
}
exports.default = getRemoteVersion;