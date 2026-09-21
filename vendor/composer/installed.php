<?php

return [
    'root' => [
        'name' => '__root__',
        'pretty_version' => 'dev-main',
        'version' => 'dev-main',
        'reference' => null,
        'type' => 'project',
        'install_path' => dirname(__DIR__),
        'aliases' => [],
        'dev' => true,
    ],
    'versions' => [
        'phpmailer/phpmailer' => [
            'pretty_version' => 'v6.12.0',
            'version' => '6.12.0.0',
            'reference' => 'd1ac35d784bf9f5e61b424901d5a014967f15b12',
            'type' => 'library',
            'install_path' => dirname(__DIR__) . '/phpmailer/phpmailer',
            'aliases' => [],
            'dev_requirement' => false,
        ],
    ],
];
