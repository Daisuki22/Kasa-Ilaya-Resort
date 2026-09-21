<?php

return [
    'PHPMailer\\PHPMailer\\' => [dirname(__DIR__) . '/phpmailer/phpmailer/src'],
    'Psr\\Log\\' => [dirname(__DIR__) . '/compat/psr/log'],
    'League\\OAuth2\\Client\\Grant\\' => [dirname(__DIR__) . '/compat/league/oauth2-client/Grant'],
    'League\\OAuth2\\Client\\Provider\\' => [dirname(__DIR__) . '/compat/league/oauth2-client/Provider'],
    'League\\OAuth2\\Client\\Token\\' => [dirname(__DIR__) . '/compat/league/oauth2-client/Token'],
];
