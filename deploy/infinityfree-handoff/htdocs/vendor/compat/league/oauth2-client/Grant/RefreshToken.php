<?php

namespace League\OAuth2\Client\Grant;

class RefreshToken
{
    public function __toString(): string
    {
        return 'refresh_token';
    }
}
