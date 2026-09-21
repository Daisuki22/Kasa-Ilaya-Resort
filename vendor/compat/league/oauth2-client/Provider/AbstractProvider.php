<?php

namespace League\OAuth2\Client\Provider;

abstract class AbstractProvider
{
    abstract public function getAccessToken($grant, array $options = []);
}
